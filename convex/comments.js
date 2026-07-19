import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api.js';
import { internalMutation, mutation, query } from './_generated/server.js';
import { limiter } from './rateLimits.js';
import { assertAdmin, isAdmin } from './lib/auth.js';
import { isBanned } from './lib/bans.js';
import { publicComment } from './lib/serialize.js';
import {
	applyVoteChange,
	commentScore,
	countAllVotes,
	visitorVoteMap,
	voteCountsFromDoc
} from './lib/votes.js';
import { decrementUrlCount, incrementUrlCount } from './lib/urlCounts.js';

const MAX_DEPTH = 2;
const MAX_COMMENTS = 200;
const MAX_TEXT_LENGTH = 200;
const MAX_USERNAME_LENGTH = 32;
const MAX_REPLY_LENGTH = 1000;

async function consumeRateLimit(ctx, name, ipHash) {
	await limiter.limit(ctx, name, { key: ipHash, throws: true });
}

/**
 * Combined rate-limit gate + auth payload for owner (password) actions.
 * One internal mutation instead of separate limit/auth calls keeps the Node
 * action's sequential ctx.run* calls to a minimum (see Convex best practices).
 */
export const beginOwnerAction = internalMutation({
	args: { commentId: v.id('comments'), ipHash: v.string() },
	handler: async (ctx, { commentId, ipHash }) => {
		await consumeRateLimit(ctx, 'edit', ipHash);
		const doc = await ctx.db.get('comments', commentId);
		if (!doc) return null;
		return { passwordHash: doc.passwordHash, deletedAt: doc.deletedAt };
	}
});

export const list = query({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => {
		const docs = await ctx.db
			.query('comments')
			.withIndex('by_url', (q) => q.eq('url', url))
			.collect();

		const active = docs.filter((d) => d.deletedAt === null);

		// Rank whole threads, not individual comments: slicing a flat score-sorted
		// list could keep a reply while dropping its still-alive parent, which the
		// client would then mis-render as an orphan of a deleted comment.
		const byId = new Map(active.map((d) => [d._id, d]));
		const childrenOf = new Map();
		const roots = [];
		for (const doc of active) {
			if (doc.parentId && byId.has(doc.parentId)) {
				let siblings = childrenOf.get(doc.parentId);
				if (!siblings) childrenOf.set(doc.parentId, (siblings = []));
				siblings.push(doc);
			} else {
				// True top-level comments, plus replies whose parent was hard-deleted
				// (rendered as strays) — both rank as thread roots.
				roots.push(doc);
			}
		}

		roots.sort((a, b) => {
			const scoreDiff = commentScore(b) - commentScore(a);
			if (scoreDiff !== 0) return scoreDiff;
			return b._creationTime - a._creationTime;
		});

		// Take threads in rank order until the cap is reached; the last thread is
		// always included whole so replies never lose their parent.
		const top = [];
		for (const root of roots) {
			if (top.length >= MAX_COMMENTS) break;
			const stack = [root];
			while (stack.length > 0) {
				const doc = stack.pop();
				top.push(doc);
				for (const child of childrenOf.get(doc._id) ?? []) stack.push(child);
			}
		}

		// One indexed scan for everything this visitor voted on, instead of a
		// per-comment lookup. Denormalized doc counts cover the totals; the
		// countAllVotes fallback only runs for legacy rows before the backfill.
		const myVotes = await visitorVoteMap(ctx, ipHash);

		return await Promise.all(
			top.map(async (doc) => {
				const counts = voteCountsFromDoc(doc) ?? (await countAllVotes(ctx, doc._id));
				return publicComment(doc, { ...counts, myVote: myVotes.get(doc._id) ?? null });
			})
		);
	}
});

export const create = mutation({
	args: {
		url: v.string(),
		username: v.string(),
		passwordHash: v.string(),
		text: v.string(),
		parentId: v.optional(v.id('comments')),
		ipHash: v.string(),
		adminSecret: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const admin = await isAdmin(args.adminSecret);

		if (await isBanned(ctx, args.ipHash)) {
			throw new ConvexError({ kind: 'Banned' });
		}

		// Enforce limits server-side: this mutation is part of the public Convex
		// API, so direct callers must not be able to bypass the SvelteKit/Zod layer.
		const username = args.username.trim() || 'Anonymous';
		if (args.text.length < 1 || args.text.length > MAX_TEXT_LENGTH) {
			throw new ConvexError({ kind: 'BadRequest', message: 'Comment must be 1-200 characters' });
		}
		if (username.length > MAX_USERNAME_LENGTH) {
			throw new ConvexError({
				kind: 'BadRequest',
				message: 'Username must be 32 characters or less'
			});
		}

		let depth = 0;
		let parentId = null;
		if (args.parentId) {
			const parent = await ctx.db.get('comments', args.parentId);
			if (!parent || parent.deletedAt !== null) {
				throw new ConvexError({ kind: 'NotFound', message: 'Parent comment not found' });
			}
			if (parent.depth >= MAX_DEPTH) {
				throw new ConvexError({ kind: 'BadRequest', message: 'Maximum reply depth reached' });
			}
			depth = parent.depth + 1;
			parentId = args.parentId;
		}

		// Consume the token only after validation so a rejected request (bad
		// parent, bad input) doesn't burn part of the caller's budget.
		if (!admin) await consumeRateLimit(ctx, 'comment', args.ipHash);

		const id = await ctx.db.insert('comments', {
			url: args.url,
			username,
			passwordHash: args.passwordHash,
			text: args.text,
			ipHash: args.ipHash,
			parentId,
			depth,
			reply: null,
			updatedAt: null,
			deletedAt: null,
			upvotes: 0,
			downvotes: 0
		});

		await incrementUrlCount(ctx, args.url);

		const doc = await ctx.db.get('comments', id);
		return publicComment(doc, { upvotes: 0, downvotes: 0, myVote: null });
	}
});

export const vote = mutation({
	args: {
		commentId: v.id('comments'),
		voteType: v.union(v.literal('up'), v.literal('down')),
		ipHash: v.string(),
		adminSecret: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const admin = await isAdmin(args.adminSecret);

		if (await isBanned(ctx, args.ipHash)) {
			throw new ConvexError({ kind: 'Banned' });
		}

		if (!admin) await consumeRateLimit(ctx, 'vote', args.ipHash);

		const comment = await ctx.db.get('comments', args.commentId);
		if (!comment || comment.deletedAt !== null) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		const { upvotes, downvotes, myVote } = await applyVoteChange(
			ctx,
			comment,
			args.voteType,
			args.ipHash
		);

		return { upvotes, downvotes, myVote };
	}
});

export const applyEdit = internalMutation({
	args: {
		commentId: v.id('comments'),
		text: v.string()
	},
	handler: async (ctx, args) => {
		const comment = await ctx.db.get('comments', args.commentId);
		if (!comment || comment.deletedAt !== null) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		const updatedAt = Date.now();
		await ctx.db.patch('comments', args.commentId, { text: args.text, updatedAt });
		return { id: args.commentId, text: args.text, updatedAt };
	}
});

export const softDelete = internalMutation({
	args: {
		commentId: v.id('comments')
	},
	handler: async (ctx, args) => {
		const comment = await ctx.db.get('comments', args.commentId);
		if (!comment || comment.deletedAt !== null) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		await ctx.db.patch('comments', args.commentId, {
			text: '[deleted]',
			username: '[deleted]',
			updatedAt: Date.now()
		});
	}
});

// Per-mutation cap on hard-deleted comments, so one call can't blow past
// Convex transaction limits on a huge thread. Overflow continues via the
// scheduler (same pattern as backfill.js).
const HARD_DELETE_BATCH = 200;

/**
 * Hard-delete up to HARD_DELETE_BATCH still-active comments in the subtree
 * rooted at `rootId` (votes removed, url counts decremented, deletedAt set).
 * Schedules a continuation when the subtree is larger than one batch.
 */
async function hardDeleteSubtree(ctx, rootId) {
	// BFS the subtree, collecting active docs until one batch is full. Already
	// hard-deleted nodes are skipped but still traversed, so continuations can
	// reach active grandchildren under a deleted parent.
	const toDelete = [];
	const queue = [rootId];
	for (let i = 0; i < queue.length && toDelete.length <= HARD_DELETE_BATCH; i++) {
		const doc = await ctx.db.get('comments', queue[i]);
		if (doc && doc.deletedAt === null) toDelete.push(doc);

		const children = await ctx.db
			.query('comments')
			.withIndex('by_parent', (q) => q.eq('parentId', queue[i]))
			.collect();
		for (const child of children) {
			queue.push(child._id);
		}
	}

	const hasOverflow = toDelete.length > HARD_DELETE_BATCH;
	const batch = hasOverflow ? toDelete.slice(0, HARD_DELETE_BATCH) : toDelete;

	const now = Date.now();
	for (const doc of batch) {
		await decrementUrlCount(ctx, doc.url);

		const votes = await ctx.db
			.query('commentVotes')
			.withIndex('by_comment_ip', (q) => q.eq('commentId', doc._id))
			.collect();
		for (const vote of votes) {
			await ctx.db.delete('commentVotes', vote._id);
		}
		await ctx.db.patch('comments', doc._id, { deletedAt: now });
	}

	if (hasOverflow) {
		await ctx.scheduler.runAfter(0, internal.comments.hardDeleteContinue, {
			commentId: rootId
		});
	}
}

export const hardDeleteContinue = internalMutation({
	args: { commentId: v.id('comments') },
	handler: async (ctx, { commentId }) => {
		await hardDeleteSubtree(ctx, commentId);
	}
});

export const hardDelete = mutation({
	args: { commentId: v.id('comments'), adminSecret: v.string() },
	handler: async (ctx, { commentId, adminSecret }) => {
		await assertAdmin(adminSecret);

		// Already hard-deleted (or missing): descendants and votes were handled by
		// the original call, so a retry/double-click has nothing left to do.
		const root = await ctx.db.get('comments', commentId);
		if (!root || root.deletedAt !== null) return;

		await hardDeleteSubtree(ctx, commentId);
	}
});

export const setReply = mutation({
	args: {
		commentId: v.id('comments'),
		reply: v.string(),
		adminSecret: v.string()
	},
	handler: async (ctx, { commentId, reply, adminSecret }) => {
		await assertAdmin(adminSecret);

		const comment = await ctx.db.get('comments', commentId);
		if (!comment || comment.deletedAt !== null) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		const trimmed = reply.trim();
		if (trimmed.length > MAX_REPLY_LENGTH) {
			throw new ConvexError({
				kind: 'BadRequest',
				message: 'Reply must be 1000 characters or less'
			});
		}

		await ctx.db.patch('comments', commentId, { reply: trimmed || null });
	}
});

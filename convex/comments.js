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
import { applyUrlCountDeltas, incrementUrlCount } from './lib/urlCounts.js';

const MAX_DEPTH = 2;
const MAX_COMMENTS = 200;
const MAX_TEXT_LENGTH = 200;
const MAX_USERNAME_LENGTH = 32;
const MAX_REPLY_LENGTH = 1000;

async function consumeRateLimit(ctx, name, ipHash) {
	await limiter.limit(ctx, name, { key: ipHash, throws: true });
}

/**
 * Ban + rate-limit gate for a would-be comment, consuming nothing. It only moves
 * the rejection in front of the ~100ms of bcrypt `create` would otherwise spend
 * before it could say the IP is banned.
 *
 * `limiter.check`, not `limiter.limit`: `create` consumes the token and stays
 * the authority, and a caller that skips this is checked there exactly as before.
 *
 * A mutation, not a query: a token bucket refills with the clock, and Convex
 * freezes time inside a query and caches the result — a cached `ok: false` would
 * outlive its window with no write to invalidate it.
 */
export const checkCanCreate = mutation({
	args: { ipHash: v.string(), adminSecret: v.optional(v.string()) },
	handler: async (ctx, { ipHash, adminSecret }) => {
		if (await isAdmin(adminSecret)) return;

		if (await isBanned(ctx, ipHash)) {
			throw new ConvexError({ kind: 'Banned' });
		}

		const { ok, retryAfter } = await limiter.check(ctx, 'comment', { key: ipHash });
		if (!ok) {
			throw new ConvexError({ kind: 'RateLimited', name: 'comment', retryAfter });
		}
	}
});

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
		// Bound on `deletedAt` too, so hard-deleted tombstones — which stay in the
		// table forever — are skipped at the index rather than read and filtered.
		const active = await ctx.db
			.query('comments')
			.withIndex('by_url_deleted', (q) => q.eq('url', url).eq('deletedAt', null))
			.collect();

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
			// A reply must belong to the same page as its parent, or it renders as
			// a cross-page stray whose hard-delete would still touch its URL count.
			if (parent.url !== args.url) {
				throw new ConvexError({
					kind: 'BadRequest',
					message: 'Parent comment is on a different page'
				});
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

		// Read back rather than serialized from the arguments: `_creationTime` is
		// Convex's to set, and this get is served from the transaction's own write
		// set, so it costs no round trip.
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

		// Same limits as `create`, so a direct caller can't bypass the
		// SvelteKit/Zod layer and store an unbounded edit.
		if (args.text.length < 1 || args.text.length > MAX_TEXT_LENGTH) {
			throw new ConvexError({ kind: 'BadRequest', message: 'Comment must be 1-200 characters' });
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
 * Hard-delete up to HARD_DELETE_BATCH still-active comments reachable from
 * `frontier` (votes removed, url counts decremented, deletedAt set).
 *
 * The continuation resumes from the nodes this walk did not reach, rather than
 * restarting at the root. Restarting re-issued a `by_parent` query for every
 * node already retired by an earlier batch, so the reads to delete a subtree
 * grew with the square of its size.
 */
async function hardDeleteFrom(ctx, frontier) {
	// BFS, collecting active docs until one batch is full. Already hard-deleted
	// nodes are skipped but still traversed, so the walk reaches active
	// grandchildren under a deleted parent.
	const batch = [];
	const queue = [...frontier];
	let i = 0;
	for (; i < queue.length && batch.length < HARD_DELETE_BATCH; i++) {
		const doc = await ctx.db.get('comments', queue[i]);
		if (doc && doc.deletedAt === null) batch.push(doc);

		const children = await ctx.db
			.query('comments')
			.withIndex('by_parent', (q) => q.eq('parentId', queue[i]))
			.collect();
		for (const child of children) {
			queue.push(child._id);
		}
	}

	const now = Date.now();
	// One counter write per URL instead of one per comment — every comment in a
	// subtree shares a URL, so this was 200 reads and 200 patches of one row.
	const urlDeltas = new Map();
	for (const doc of batch) {
		urlDeltas.set(doc.url, (urlDeltas.get(doc.url) ?? 0) - 1);

		const votes = await ctx.db
			.query('commentVotes')
			.withIndex('by_comment_ip', (q) => q.eq('commentId', doc._id))
			.collect();
		for (const vote of votes) {
			await ctx.db.delete('commentVotes', vote._id);
		}
		await ctx.db.patch('comments', doc._id, { deletedAt: now });
	}
	await applyUrlCountDeltas(ctx, urlDeltas);

	const rest = queue.slice(i);
	if (rest.length > 0) {
		await ctx.scheduler.runAfter(0, internal.comments.hardDeleteContinue, {
			frontier: rest
		});
	}
}

export const hardDeleteContinue = internalMutation({
	args: { frontier: v.array(v.id('comments')) },
	handler: async (ctx, { frontier }) => {
		await hardDeleteFrom(ctx, frontier);
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

		await hardDeleteFrom(ctx, [commentId]);
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

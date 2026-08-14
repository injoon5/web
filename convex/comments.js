import { paginationOptsValidator } from 'convex/server';
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
import { isScoresBackfillComplete } from './lib/migration.js';
import { applyUrlCountDeltas, incrementUrlCount } from './lib/urlCounts.js';

const MAX_DEPTH = 2;
const MAX_TEXT_LENGTH = 200;
const MAX_USERNAME_LENGTH = 32;
const MAX_REPLY_LENGTH = 1000;
// Bounds the legacy rank fallback below, before the score backfill has run.
const MAX_LEGACY_COMMENTS = 200;

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

/**
 * Walk one thread from its root. Depth is capped at MAX_DEPTH, so this is a
 * handful of `by_parent` reads, not a scan of the page.
 */
async function threadFromRoot(ctx, root) {
	const docs = [root];
	const queue = [root._id];
	for (let i = 0; i < queue.length; i++) {
		const children = await ctx.db
			.query('comments')
			.withIndex('by_parent', (q) => q.eq('parentId', queue[i]))
			.collect();
		for (const child of children) {
			if (child.deletedAt !== null) continue;
			docs.push(child);
			queue.push(child._id);
		}
	}
	return docs;
}

/**
 * Serialize a whole thread from its root into public comment shapes, in tree
 * order (root, then its replies, then theirs).
 */
async function serializeThread(ctx, root, myVotes) {
	const docs = await threadFromRoot(ctx, root);
	return Promise.all(
		docs.map(async (doc) => {
			const counts = voteCountsFromDoc(doc) ?? (await countAllVotes(ctx, doc._id));
			return publicComment(doc, { ...counts, myVote: myVotes.get(doc._id) ?? null });
		})
	);
}

export const list = query({
	args: {
		url: v.string(),
		ipHash: v.string(),
		paginationOpts: v.optional(paginationOptsValidator)
	},
	handler: async (ctx, { url, ipHash, paginationOpts }) => {
		const opts = paginationOpts ?? { numItems: 50, cursor: null };
		const myVotes = await visitorVoteMap(ctx, ipHash);

		// Roots are ranked by a denormalized `score`, kept in step with the vote
		// counts on every write and backfilled for rows that predate it. Until
		// that backfill has run, a root without a score has no entry in the ranked
		// index, so it would silently vanish — fall back to a bounded whole-page
		// rank instead (the same flag-gated pattern as `readLikeCount`).
		if (!(await isScoresBackfillComplete(ctx))) {
			const active = await ctx.db
				.query('comments')
				.withIndex('by_url_deleted', (q) => q.eq('url', url).eq('deletedAt', null))
				.collect();

			// Roots: true top-level comments, plus replies whose parent was
			// hard-deleted (rendered as strays) — both rank as thread roots.
			const byId = new Map(active.map((d) => [d._id, d]));
			const roots = active.filter((d) => !d.parentId || !byId.has(d.parentId));
			roots.sort((a, b) => commentScore(b) - commentScore(a) || b._creationTime - a._creationTime);

			const page = [];
			for (const root of roots) {
				if (page.length >= MAX_LEGACY_COMMENTS) break;
				page.push(...(await serializeThread(ctx, root, myVotes)));
			}
			return { page, isDone: true, continueCursor: '' };
		}

		// Whole threads per page, so a later page never holds a reply whose
		// parent was on an earlier one. `.order('desc')` ranks by score desc,
		// newest first on ties.
		const result = await ctx.db
			.query('comments')
			.withIndex('by_url_deleted_parent_score', (q) =>
				q.eq('url', url).eq('deletedAt', null).eq('parentId', null)
			)
			.order('desc')
			.paginate(opts);

		const page = [];
		for (const root of result.page) {
			page.push(...(await serializeThread(ctx, root, myVotes)));
		}

		return { ...result, page };
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
			downvotes: 0,
			score: 0
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

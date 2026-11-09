import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import { internal } from './_generated/api.js';
import { internalMutation, mutation, query } from './_generated/server.js';
import { limiter } from './rateLimits.js';
import { assertAdmin } from './lib/auth.js';
import { fail } from './lib/errors.js';
import { beginVisitorWrite, visitorWriteArgs } from './lib/visitorWrite.js';
import { publicComment } from './lib/serialize.js';
import {
	applyVoteChange,
	commentScore,
	countAllVotes,
	visitorVoteMap,
	voteCountsFromDoc
} from './lib/votes.js';
import { isScoresBackfillComplete } from './lib/migration.js';
import { adjustCount, applyCountDeltas } from './lib/counter.js';
import {
	ANONYMOUS,
	DELETED_TEXT,
	MAX_DEPTH,
	MAX_REPLY_LENGTH,
	commentTextError,
	isSoftDeleted,
	usernameError
} from './lib/commentRules.js';

// Bounds the legacy rank fallback below, before the score backfill has run.
const MAX_LEGACY_COMMENTS = 200;

function validText(text) {
	const trimmed = text.trim();
	const problem = commentTextError(trimmed);
	if (problem) fail('BadRequest', problem);
	return trimmed;
}

/**
 * Ban + rate-limit gate for a would-be comment, consuming nothing. It only moves
 * the rejection in front of the ~100ms of bcrypt `create` would otherwise spend
 * before it could say the IP is banned. It is the same gate `create` runs, so it
 * rejects exactly what `create` would.
 *
 * `check`, not `spend`: `create` consumes the token and stays the authority.
 *
 * A mutation, not a query: a token bucket refills with the clock, and Convex
 * freezes time inside a query and caches the result — a cached `ok: false` would
 * outlive its window with no write to invalidate it.
 */
export const checkCanCreate = mutation({
	args: visitorWriteArgs,
	handler: async (ctx, args) => {
		const visitor = await beginVisitorWrite(ctx, args);
		await visitor.check('comment');
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
		await limiter.limit(ctx, 'edit', { key: ipHash, throws: true });
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
		paginationOpts: paginationOptsValidator
	},
	handler: async (ctx, { url, ipHash, paginationOpts }) => {
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
			.paginate(paginationOpts);

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
		...visitorWriteArgs
	},
	handler: async (ctx, args) => {
		const visitor = await beginVisitorWrite(ctx, args);

		// This mutation is public, so its limits cannot be left to the Zod layer.
		const text = validText(args.text);
		const username = args.username.trim() || ANONYMOUS;
		const usernameProblem = usernameError(username);
		if (usernameProblem) fail('BadRequest', usernameProblem);

		let depth = 0;
		let parentId = null;
		if (args.parentId) {
			const parent = await ctx.db.get('comments', args.parentId);
			if (!parent || parent.deletedAt !== null) {
				fail('NotFound', 'Parent comment not found');
			}
			// A reply must belong to the same page as its parent, or it renders as
			// a cross-page stray whose hard-delete would still touch its URL count.
			if (parent.url !== args.url) {
				fail('BadRequest', 'Parent comment is on a different page');
			}
			if (parent.depth >= MAX_DEPTH) {
				fail('BadRequest', 'Maximum reply depth reached');
			}
			depth = parent.depth + 1;
			parentId = args.parentId;
		}

		// Consume the token only after validation so a rejected request (bad
		// parent, bad input) doesn't burn part of the caller's budget.
		await visitor.spend('comment');

		const id = await ctx.db.insert('comments', {
			url: args.url,
			username,
			passwordHash: args.passwordHash,
			text,
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

		await adjustCount(ctx, 'commentUrlCounts', args.url, 1);

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
		...visitorWriteArgs
	},
	handler: async (ctx, args) => {
		const visitor = await beginVisitorWrite(ctx, args);

		const comment = await ctx.db.get('comments', args.commentId);
		if (!comment || comment.deletedAt !== null) {
			fail('NotFound', 'Comment not found');
		}
		await visitor.spend('vote');

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
		// A soft-deleted comment still has its row and password hash, so without
		// this its owner could edit it back to life under the name `[deleted]`.
		if (!comment || comment.deletedAt !== null || isSoftDeleted(comment)) {
			fail('NotFound', 'Comment not found');
		}

		const text = validText(args.text);
		const updatedAt = Date.now();
		await ctx.db.patch('comments', args.commentId, { text, updatedAt });
		return { id: args.commentId, text, updatedAt };
	}
});

async function softDeleteComment(ctx, commentId) {
	const comment = await ctx.db.get('comments', commentId);
	if (!comment || comment.deletedAt !== null) fail('NotFound', 'Comment not found');

	await ctx.db.patch('comments', commentId, {
		text: DELETED_TEXT,
		username: DELETED_TEXT,
		updatedAt: Date.now()
	});
}

/** The owner's soft delete, run by `commentActions.softDeleteComment` once the password checks out. */
export const softDelete = internalMutation({
	args: { commentId: v.id('comments') },
	handler: async (ctx, { commentId }) => softDeleteComment(ctx, commentId)
});

export const adminSoftDelete = mutation({
	args: { commentId: v.id('comments'), adminSecret: v.string() },
	handler: async (ctx, { commentId, adminSecret }) => {
		await assertAdmin(adminSecret);
		await softDeleteComment(ctx, commentId);
	}
});

// Per-mutation cap on hard-deleted comments, so one call can't blow past
// Convex transaction limits on a huge thread. Overflow continues via the
// scheduler (same pattern as backfill.js).
const HARD_DELETE_BATCH = 200;

/**
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
	await applyCountDeltas(ctx, 'commentUrlCounts', urlDeltas);

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
			fail('NotFound', 'Comment not found');
		}

		const trimmed = reply.trim();
		if (trimmed.length > MAX_REPLY_LENGTH) {
			fail('BadRequest', `Reply must be ${MAX_REPLY_LENGTH} characters or less`);
		}

		await ctx.db.patch('comments', commentId, { reply: trimmed || null });
	}
});

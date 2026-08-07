import { v } from 'convex/values';
import { internal } from './_generated/api.js';
import { internalMutation } from './_generated/server.js';
import {
	setLikeCountsBackfillComplete,
	setUrlCountsBackfillComplete,
	setVoteCountsBackfillComplete
} from './lib/migration.js';
import { applyUrlCountDeltas } from './lib/urlCounts.js';
import { applyLikeCountDeltas } from './lib/likeCounts.js';
import { countAllVotes } from './lib/votes.js';

const BATCH_SIZE = 100;
// One counter row per distinct URL, so this is comfortably the whole table.
const RESET_LIMIT = 2000;

export const backfillVoteCountsBatch = internalMutation({
	args: { cursor: v.union(v.string(), v.null()) },
	handler: async (ctx, { cursor }) => {
		const batch = await ctx.db.query('comments').paginate({
			numItems: BATCH_SIZE,
			cursor
		});

		for (const doc of batch.page) {
			if (doc.upvotes !== undefined && doc.downvotes !== undefined) continue;
			const { upvotes, downvotes } = await countAllVotes(ctx, doc._id);
			await ctx.db.patch('comments', doc._id, { upvotes, downvotes });
		}

		if (!batch.isDone) {
			await ctx.scheduler.runAfter(0, internal.backfill.backfillVoteCountsBatch, {
				cursor: batch.continueCursor
			});
			return;
		}

		await setVoteCountsBackfillComplete(ctx);
	}
});

export const backfillUrlCountsBatch = internalMutation({
	args: {
		cursor: v.union(v.string(), v.null()),
		reset: v.boolean()
	},
	handler: async (ctx, { cursor, reset }) => {
		if (reset) {
			// Bounded: an unbounded collect-and-delete is one transaction whose size
			// grows with the table.
			const existing = await ctx.db.query('commentUrlCounts').take(RESET_LIMIT);
			for (const row of existing) {
				await ctx.db.delete('commentUrlCounts', row._id);
			}
		}

		const batch = await ctx.db.query('comments').paginate({
			numItems: BATCH_SIZE,
			cursor
		});

		// Tally the page first, then one read-modify-write per distinct URL. A
		// batch is 100 comments over a handful of URLs, so stepping the counter
		// once per comment re-read and re-patched the same rows ~100 times.
		const deltas = new Map();
		for (const doc of batch.page) {
			if (doc.deletedAt !== null) continue;
			deltas.set(doc.url, (deltas.get(doc.url) ?? 0) + 1);
		}
		await applyUrlCountDeltas(ctx, deltas);

		if (!batch.isDone) {
			await ctx.scheduler.runAfter(0, internal.backfill.backfillUrlCountsBatch, {
				cursor: batch.continueCursor,
				reset: false
			});
			return;
		}

		await setUrlCountsBackfillComplete(ctx);
	}
});

export const backfillLikeCountsBatch = internalMutation({
	args: {
		cursor: v.union(v.string(), v.null()),
		reset: v.boolean()
	},
	handler: async (ctx, { cursor, reset }) => {
		if (reset) {
			const existing = await ctx.db.query('likeCounts').take(RESET_LIMIT);
			for (const row of existing) {
				await ctx.db.delete('likeCounts', row._id);
			}
		}

		const batch = await ctx.db.query('likes').paginate({
			numItems: BATCH_SIZE,
			cursor
		});

		const deltas = new Map();
		for (const doc of batch.page) {
			deltas.set(doc.url, (deltas.get(doc.url) ?? 0) + 1);
		}
		await applyLikeCountDeltas(ctx, deltas);

		if (!batch.isDone) {
			await ctx.scheduler.runAfter(0, internal.backfill.backfillLikeCountsBatch, {
				cursor: batch.continueCursor,
				reset: false
			});
			return;
		}

		await setLikeCountsBackfillComplete(ctx);
	}
});

// Internal: it has no caller in the app, and a public mutation is reachable by
// anyone with the deployment URL. Run it from the Convex dashboard.
export const run = internalMutation({
	args: {},
	handler: async (ctx) => {
		await ctx.scheduler.runAfter(0, internal.backfill.backfillVoteCountsBatch, {
			cursor: null
		});
		await ctx.scheduler.runAfter(0, internal.backfill.backfillUrlCountsBatch, {
			cursor: null,
			reset: true
		});
		await ctx.scheduler.runAfter(0, internal.backfill.backfillLikeCountsBatch, {
			cursor: null,
			reset: true
		});

		return { started: true };
	}
});

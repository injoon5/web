import { v } from 'convex/values';
import { internal } from './_generated/api.js';
import { internalMutation, mutation } from './_generated/server.js';
import { assertAdmin } from './lib/auth.js';
import { setUrlCountsBackfillComplete } from './lib/migration.js';
import { incrementUrlCount } from './lib/urlCounts.js';
import { countAllVotes } from './lib/votes.js';

const BATCH_SIZE = 100;

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
			await ctx.db.patch(doc._id, { upvotes, downvotes });
		}

		if (!batch.isDone) {
			await ctx.scheduler.runAfter(0, internal.backfill.backfillVoteCountsBatch, {
				cursor: batch.continueCursor
			});
		}
	}
});

export const backfillUrlCountsBatch = internalMutation({
	args: {
		cursor: v.union(v.string(), v.null()),
		reset: v.boolean()
	},
	handler: async (ctx, { cursor, reset }) => {
		if (reset) {
			const existing = await ctx.db.query('commentUrlCounts').collect();
			for (const row of existing) {
				await ctx.db.delete(row._id);
			}
		}

		const batch = await ctx.db.query('comments').paginate({
			numItems: BATCH_SIZE,
			cursor
		});

		for (const doc of batch.page) {
			if (doc.deletedAt !== null) continue;
			await incrementUrlCount(ctx, doc.url);
		}

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

export const run = mutation({
	args: { adminSecret: v.string() },
	handler: async (ctx, { adminSecret }) => {
		await assertAdmin(adminSecret);

		await ctx.scheduler.runAfter(0, internal.backfill.backfillVoteCountsBatch, {
			cursor: null
		});
		await ctx.scheduler.runAfter(0, internal.backfill.backfillUrlCountsBatch, {
			cursor: null,
			reset: true
		});

		return { started: true };
	}
});

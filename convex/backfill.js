import { v } from 'convex/values';
import { internal } from './_generated/api.js';
import { internalMutation, mutation } from './_generated/server.js';
import { assertAdmin } from './lib/auth.js';
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

export const backfillUrlCounts = internalMutation({
	args: {},
	handler: async (ctx) => {
		const existing = await ctx.db.query('commentUrlCounts').collect();
		for (const row of existing) {
			await ctx.db.delete(row._id);
		}

		const counts = new Map();
		let cursor = null;

		do {
			const batch = await ctx.db.query('comments').paginate({
				numItems: BATCH_SIZE,
				cursor
			});

			for (const doc of batch.page) {
				if (doc.deletedAt !== null) continue;
				counts.set(doc.url, (counts.get(doc.url) ?? 0) + 1);
			}

			cursor = batch.isDone ? null : batch.continueCursor;
		} while (cursor);

		for (const [url, count] of counts) {
			await ctx.db.insert('commentUrlCounts', { url, count });
		}
	}
});

export const run = mutation({
	args: { adminSecret: v.string() },
	handler: async (ctx, { adminSecret }) => {
		await assertAdmin(adminSecret);

		await ctx.scheduler.runAfter(0, internal.backfill.backfillVoteCountsBatch, {
			cursor: null
		});
		await ctx.scheduler.runAfter(0, internal.backfill.backfillUrlCounts, {});

		return { started: true };
	}
});

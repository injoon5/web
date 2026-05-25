import { v } from 'convex/values';
import { query } from './_generated/server.js';
import { assertAdmin } from './lib/auth.js';
import { countActiveCommentsByUrl } from './lib/commentsScan.js';
import { adminComment } from './lib/serialize.js';
import { isUrlCountsBackfillComplete } from './lib/migration.js';
import { getVoteCounts, voteCountsFromDoc } from './lib/votes.js';

export const listUrls = query({
	args: { adminSecret: v.string() },
	handler: async (ctx, { adminSecret }) => {
		await assertAdmin(adminSecret);

		const backfillComplete = await isUrlCountsBackfillComplete(ctx);
		const rows = await ctx.db.query('commentUrlCounts').collect();
		const counts = new Map(rows.map(({ url, count }) => [url, count]));

		if (!backfillComplete) {
			const scanned = await countActiveCommentsByUrl(ctx);
			for (const [url, count] of scanned) {
				counts.set(url, count);
			}
		}

		return Array.from(counts.entries())
			.map(([url, count]) => ({ url, count }))
			.sort((a, b) => b.count - a.count);
	}
});

export const listForUrl = query({
	args: { url: v.string(), adminSecret: v.string() },
	handler: async (ctx, { url, adminSecret }) => {
		await assertAdmin(adminSecret);

		const docs = await ctx.db
			.query('comments')
			.withIndex('by_url', (q) => q.eq('url', url))
			.collect();

		const active = docs.filter((d) => d.deletedAt === null);
		active.sort((a, b) => a._creationTime - b._creationTime);

		return await Promise.all(
			active.map(async (doc) => {
				const cached = voteCountsFromDoc(doc);
				const { upvotes, downvotes } = cached ?? (await getVoteCounts(ctx, doc, ''));
				return adminComment(doc, { upvotes, downvotes });
			})
		);
	}
});

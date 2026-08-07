import { v } from 'convex/values';
import { query } from './_generated/server.js';
import { assertAdmin } from './lib/auth.js';
import { countActiveCommentsByUrl } from './lib/commentsScan.js';
import { adminComment } from './lib/serialize.js';
import { isUrlCountsBackfillComplete } from './lib/migration.js';
import { getVoteCounts, voteCountsFromDoc } from './lib/votes.js';

// One row per commented-on URL — a bound, not a page.
const URL_LIMIT = 2000;

export const listUrls = query({
	args: { adminSecret: v.string() },
	handler: async (ctx, { adminSecret }) => {
		await assertAdmin(adminSecret);

		const backfillComplete = await isUrlCountsBackfillComplete(ctx);
		const rows = await ctx.db.query('commentUrlCounts').take(URL_LIMIT);
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

		// Tombstones are skipped at the index — see the `by_url_deleted` note in
		// convex/schema.js.
		const active = await ctx.db
			.query('comments')
			.withIndex('by_url_deleted', (q) => q.eq('url', url).eq('deletedAt', null))
			.collect();

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

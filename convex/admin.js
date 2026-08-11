import { v } from 'convex/values';
import { query } from './_generated/server.js';
import { assertAdminAccess } from './lib/adminSession.js';
import { countActiveCommentsByUrl } from './lib/commentsScan.js';
import { adminComment } from './lib/serialize.js';
import { isUrlCountsBackfillComplete } from './lib/migration.js';
import { getVoteCounts, voteCountsFromDoc } from './lib/votes.js';

// One row per commented-on URL — a bound, not a page.
const URL_LIMIT = 2000;

// Both admin credentials are optional in the validator and neither is optional
// in effect: `assertAdminAccess` throws unless one of them checks out. The
// server routes send `adminSecret`; the dashboard's own subscriptions send
// `sessionToken`. See convex/lib/adminSession.js.
const adminAuthArgs = {
	adminSecret: v.optional(v.string()),
	sessionToken: v.optional(v.string())
};

export const listUrls = query({
	args: adminAuthArgs,
	handler: async (ctx, { adminSecret, sessionToken }) => {
		await assertAdminAccess(ctx, { adminSecret, sessionToken });

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
	args: { url: v.string(), ...adminAuthArgs },
	handler: async (ctx, { url, adminSecret, sessionToken }) => {
		await assertAdminAccess(ctx, { adminSecret, sessionToken });

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

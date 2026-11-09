import { v } from 'convex/values';
import { query } from './_generated/server.js';
import { adminAuthArgs, assertAdminAccess } from './lib/adminSession.js';
import { countActiveCommentsByUrl } from './lib/commentsScan.js';
import { adminComment } from './lib/serialize.js';
import { isUrlCountsBackfillComplete } from './lib/migration.js';
import { countAllVotes, voteCountsFromDoc } from './lib/votes.js';

// One row per commented-on URL — a bound, not a page.
const URL_LIMIT = 2000;

export const listUrls = query({
	args: adminAuthArgs,
	handler: async (ctx, { adminSecret, sessionToken }) => {
		await assertAdminAccess(ctx, { adminSecret, sessionToken });

		const backfillComplete = await isUrlCountsBackfillComplete(ctx);
		// One row per commented-on URL (plus rare duplicate rows from a
		// concurrent first insert). A bounded `.take()` read the oldest rows and
		// dropped later URLs, so read the whole counter table — it is one row per
		// URL — and fold duplicates by summing, matching `readLikeCount`.
		const rows = await ctx.db.query('commentUrlCounts').collect();
		const counts = new Map();
		for (const { url, count } of rows) {
			counts.set(url, (counts.get(url) ?? 0) + count);
		}

		if (!backfillComplete) {
			const scanned = await countActiveCommentsByUrl(ctx);
			for (const [url, count] of scanned) {
				counts.set(url, count);
			}
		}

		return Array.from(counts.entries())
			.map(([url, count]) => ({ url, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, URL_LIMIT);
	}
});

export const listForUrl = query({
	args: { url: v.string(), ...adminAuthArgs },
	handler: async (ctx, { url, adminSecret, sessionToken }) => {
		await assertAdminAccess(ctx, { adminSecret, sessionToken });

		// Tombstones are skipped at the index — see the note on it in
		// convex/schema.js. Sorted below, so the index's own order is moot.
		const active = await ctx.db
			.query('comments')
			.withIndex('by_url_deleted_parent_score', (q) => q.eq('url', url).eq('deletedAt', null))
			.collect();

		active.sort((a, b) => a._creationTime - b._creationTime);

		return await Promise.all(
			active.map(async (doc) => {
				const counts = voteCountsFromDoc(doc) ?? (await countAllVotes(ctx, doc._id));
				return adminComment(doc, counts);
			})
		);
	}
});

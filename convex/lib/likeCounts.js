import { isLikeCountsBackfillComplete } from './migration.js';
import { readCount } from './counter.js';

/**
 * Read-only like count, safe to call from queries.
 *
 * Falls back to counting rows directly until the backfill flag is set, after
 * which the denormalized counter is authoritative and reads stay O(1).
 */
export async function readLikeCount(ctx, url) {
	if (!(await isLikeCountsBackfillComplete(ctx))) {
		const rows = await ctx.db
			.query('likes')
			.withIndex('by_url_ip', (q) => q.eq('url', url))
			.collect();
		return rows.length;
	}
	return readCount(ctx, 'likeCounts', url);
}

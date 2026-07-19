import { isLikeCountsBackfillComplete } from './migration.js';
import { incrementCount, decrementCount } from './counter.js';

const TABLE = 'likeCounts';

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
	const rows = await ctx.db
		.query(TABLE)
		.withIndex('by_url', (q) => q.eq('url', url))
		.collect();
	return rows.reduce((sum, row) => sum + row.count, 0);
}

export function incrementLikeCount(ctx, url) {
	return incrementCount(ctx, TABLE, url);
}

export function decrementLikeCount(ctx, url) {
	return decrementCount(ctx, TABLE, url);
}

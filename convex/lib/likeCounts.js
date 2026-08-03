import { isLikeCountsBackfillComplete } from './migration.js';
import { adjustCount } from './counter.js';

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

/** Move a URL's like count by `delta` in one read-modify-write. */
export function adjustLikeCount(ctx, url, delta) {
	return adjustCount(ctx, TABLE, url, delta);
}

/**
 * Apply a whole batch of counted URLs at once — one read-modify-write per
 * distinct URL rather than per like row.
 *
 * @param {Map<string, number>} deltas  url -> signed change
 */
export async function applyLikeCountDeltas(ctx, deltas) {
	for (const [url, delta] of deltas) {
		if (delta !== 0) await adjustCount(ctx, TABLE, url, delta);
	}
}

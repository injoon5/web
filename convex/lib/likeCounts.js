import { isLikeCountsBackfillComplete } from './migration.js';
import { incrementCount, decrementCount } from './counter.js';

const TABLE = 'likeCounts';

function counterRows(ctx, url) {
	return ctx.db
		.query(TABLE)
		.withIndex('by_url', (q) => q.eq('url', url))
		.collect();
}

/** Distinct visitors who liked a page (one row per ipHash, even if races left duplicates). */
export async function uniqueLikeCount(ctx, url) {
	const rows = await ctx.db
		.query('likes')
		.withIndex('by_url', (q) => q.eq('url', url))
		.collect();
	return new Set(rows.map((row) => row.ipHash)).size;
}

/**
 * Read-only like count, safe to call from queries.
 *
 * Until the backfill flag is set, count distinct ipHashes directly (correct if
 * duplicate rows exist from a past race). Once backfilled, the denormalized
 * counter is authoritative and reads stay O(1).
 */
export async function readLikeCount(ctx, url) {
	if (!(await isLikeCountsBackfillComplete(ctx))) {
		return uniqueLikeCount(ctx, url);
	}
	const rows = await counterRows(ctx, url);
	return rows.reduce((sum, row) => sum + row.count, 0);
}

/** Merge duplicate counter rows for a URL (rare race on concurrent first inserts). */
async function canonicalLikeCountRow(ctx, url) {
	const rows = await counterRows(ctx, url);

	if (rows.length === 0) return null;
	if (rows.length === 1) return rows[0];

	const total = rows.reduce((sum, row) => sum + row.count, 0);
	await ctx.db.patch(rows[0]._id, { count: total });
	for (let i = 1; i < rows.length; i++) {
		await ctx.db.delete(rows[i]._id);
	}
	return { ...rows[0], count: total };
}

/** Set the denormalized counter to the current unique-like count for a URL. */
export async function syncLikeCountForUrl(ctx, url) {
	const count = await uniqueLikeCount(ctx, url);
	const row = await canonicalLikeCountRow(ctx, url);

	if (count === 0) {
		if (row) await ctx.db.delete(row._id);
		return;
	}

	if (row) {
		await ctx.db.patch(row._id, { count });
		return;
	}

	await ctx.db.insert(TABLE, { url, count });
}

export function incrementLikeCount(ctx, url) {
	return incrementCount(ctx, TABLE, url);
}

export function decrementLikeCount(ctx, url) {
	return decrementCount(ctx, TABLE, url);
}

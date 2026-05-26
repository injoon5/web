import { isLikeCountsBackfillComplete } from './migration.js';

function counterRows(ctx, url) {
	return ctx.db
		.query('likeCounts')
		.withIndex('by_url', (q) => q.eq('url', url))
		.collect();
}

async function actualLikeCount(ctx, url) {
	const rows = await ctx.db
		.query('likes')
		.withIndex('by_url', (q) => q.eq('url', url))
		.collect();
	return rows.length;
}

/**
 * Read-only like count, safe to call from queries.
 *
 * Until the backfill flag is set, the denormalized counter may be missing or
 * partial for pages that had likes before this table existed, so we fall back
 * to counting rows directly (correct, just O(n)). Once backfilled, the counter
 * is authoritative and reads stay O(1).
 */
export async function readLikeCount(ctx, url) {
	if (!(await isLikeCountsBackfillComplete(ctx))) {
		return actualLikeCount(ctx, url);
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

export async function incrementLikeCount(ctx, url) {
	const row = await canonicalLikeCountRow(ctx, url);

	if (row) {
		await ctx.db.patch(row._id, { count: row.count + 1 });
		return;
	}

	await ctx.db.insert('likeCounts', { url, count: 1 });
}

export async function decrementLikeCount(ctx, url) {
	const row = await canonicalLikeCountRow(ctx, url);
	if (!row) return;

	if (row.count <= 1) {
		await ctx.db.delete(row._id);
		return;
	}

	await ctx.db.patch(row._id, { count: row.count - 1 });
}

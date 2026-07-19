/**
 * Generic denormalized counter helpers for tables with { url, count } rows
 * and a `by_url` index. Both `commentUrlCounts` and `likeCounts` share this logic.
 */

/** Merge duplicate rows for the same URL (rare race on concurrent first inserts). */
async function canonicalCountRow(ctx, table, url) {
	const rows = await ctx.db
		.query(table)
		.withIndex('by_url', (q) => q.eq('url', url))
		.collect();

	if (rows.length === 0) return null;
	if (rows.length === 1) return rows[0];

	const total = rows.reduce((sum, row) => sum + row.count, 0);
	await ctx.db.patch(table, rows[0]._id, { count: total });
	for (let i = 1; i < rows.length; i++) {
		await ctx.db.delete(table, rows[i]._id);
	}
	return { ...rows[0], count: total };
}

export async function incrementCount(ctx, table, url) {
	const row = await canonicalCountRow(ctx, table, url);
	if (row) {
		await ctx.db.patch(table, row._id, { count: row.count + 1 });
		return;
	}
	await ctx.db.insert(table, { url, count: 1 });
}

export async function decrementCount(ctx, table, url) {
	const row = await canonicalCountRow(ctx, table, url);
	if (!row) return;
	if (row.count <= 1) {
		await ctx.db.delete(table, row._id);
		return;
	}
	await ctx.db.patch(table, row._id, { count: row.count - 1 });
}

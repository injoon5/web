/** Merge duplicate rows for the same URL (rare race on concurrent first inserts). */
async function canonicalUrlCountRow(ctx, url) {
	const rows = await ctx.db
		.query('commentUrlCounts')
		.withIndex('by_url', (q) => q.eq('url', url))
		.collect();

	if (rows.length === 0) return null;
	if (rows.length === 1) return rows[0];

	const total = rows.reduce((sum, row) => sum + row.count, 0);
	await ctx.db.patch(rows[0]._id, { count: total });
	for (let i = 1; i < rows.length; i++) {
		await ctx.db.delete(rows[i]._id);
	}
	return { ...rows[0], count: total };
}

/** Increment active comment count for a page URL. */
export async function incrementUrlCount(ctx, url) {
	const row = await canonicalUrlCountRow(ctx, url);

	if (row) {
		await ctx.db.patch(row._id, { count: row.count + 1 });
		return;
	}

	await ctx.db.insert('commentUrlCounts', { url, count: 1 });
}

/** Decrement active comment count for a page URL. */
export async function decrementUrlCount(ctx, url) {
	const row = await canonicalUrlCountRow(ctx, url);
	if (!row) return;

	if (row.count <= 1) {
		await ctx.db.delete(row._id);
		return;
	}

	await ctx.db.patch(row._id, { count: row.count - 1 });
}

/** Increment active comment count for a page URL. */
export async function incrementUrlCount(ctx, url) {
	const row = await ctx.db
		.query('commentUrlCounts')
		.withIndex('by_url', (q) => q.eq('url', url))
		.unique();

	if (row) {
		await ctx.db.patch(row._id, { count: row.count + 1 });
		return;
	}

	await ctx.db.insert('commentUrlCounts', { url, count: 1 });
}

/** Decrement active comment count for a page URL. */
export async function decrementUrlCount(ctx, url) {
	const row = await ctx.db
		.query('commentUrlCounts')
		.withIndex('by_url', (q) => q.eq('url', url))
		.unique();

	if (!row) return;

	if (row.count <= 1) {
		await ctx.db.delete(row._id);
		return;
	}

	await ctx.db.patch(row._id, { count: row.count - 1 });
}

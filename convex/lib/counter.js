/**
 * Denormalized counter for tables with { url, count } rows and a `by_url`
 * index. Both `commentUrlCounts` and `likeCounts` share this logic.
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

/**
 * Move a URL's counter by `delta` in one read-modify-write, and return the
 * count it settled on.
 *
 * Takes a delta rather than stepping by one because the callers that matter
 * move it in bulk: hard-deleting a thread retires up to 200 comments that all
 * share a URL, and a backfill batch is 100 rows over a handful of URLs. Stepping
 * one at a time meant re-reading and re-patching the same row once per comment.
 */
export async function adjustCount(ctx, table, url, delta) {
	const row = await canonicalCountRow(ctx, table, url);

	if (!row) {
		if (delta <= 0) return 0;
		await ctx.db.insert(table, { url, count: delta });
		return delta;
	}

	const next = row.count + delta;
	if (next <= 0) {
		await ctx.db.delete(table, row._id);
		return 0;
	}
	if (next !== row.count) await ctx.db.patch(table, row._id, { count: next });
	return next;
}

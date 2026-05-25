const URL_COUNTS_KEY = 'urlCounts';

export async function isUrlCountsBackfillComplete(ctx) {
	const row = await ctx.db
		.query('migrationMeta')
		.withIndex('by_key', (q) => q.eq('key', URL_COUNTS_KEY))
		.unique();
	return row?.complete === true;
}

export async function setUrlCountsBackfillComplete(ctx) {
	const existing = await ctx.db
		.query('migrationMeta')
		.withIndex('by_key', (q) => q.eq('key', URL_COUNTS_KEY))
		.unique();

	if (existing) {
		await ctx.db.patch(existing._id, { complete: true });
		return;
	}

	await ctx.db.insert('migrationMeta', { key: URL_COUNTS_KEY, complete: true });
}

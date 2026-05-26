/**
 * migrationMeta — one-time backfill completion flags (not a migration runner).
 *
 * Each row: { key, complete: true }. Used so reads can skip expensive fallbacks
 * after batched backfills finish. Add a new key per backfill job.
 */

export const URL_COUNTS_KEY = 'urlCounts';
export const VOTE_COUNTS_KEY = 'voteCounts';
export const LIKE_COUNTS_KEY = 'likeCounts';

async function isBackfillComplete(ctx, key) {
	const row = await ctx.db
		.query('migrationMeta')
		.withIndex('by_key', (q) => q.eq('key', key))
		.unique();
	return row?.complete === true;
}

async function setBackfillComplete(ctx, key) {
	const existing = await ctx.db
		.query('migrationMeta')
		.withIndex('by_key', (q) => q.eq('key', key))
		.unique();

	if (existing) {
		await ctx.db.patch(existing._id, { complete: true });
		return;
	}

	await ctx.db.insert('migrationMeta', { key, complete: true });
}

export function isUrlCountsBackfillComplete(ctx) {
	return isBackfillComplete(ctx, URL_COUNTS_KEY);
}

export function setUrlCountsBackfillComplete(ctx) {
	return setBackfillComplete(ctx, URL_COUNTS_KEY);
}

export function isVoteCountsBackfillComplete(ctx) {
	return isBackfillComplete(ctx, VOTE_COUNTS_KEY);
}

export function setVoteCountsBackfillComplete(ctx) {
	return setBackfillComplete(ctx, VOTE_COUNTS_KEY);
}

export function isLikeCountsBackfillComplete(ctx) {
	return isBackfillComplete(ctx, LIKE_COUNTS_KEY);
}

export function setLikeCountsBackfillComplete(ctx) {
	return setBackfillComplete(ctx, LIKE_COUNTS_KEY);
}

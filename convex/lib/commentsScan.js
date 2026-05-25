/**
 * Shared pagination over the comments table (admin scans, backfills).
 */

/** Invoke `onBatch` for each page of comments. Returns last pagination result. */
export async function paginateCommentBatches(ctx, { pageSize, onBatch }) {
	let cursor = null;
	let lastBatch = null;

	do {
		lastBatch = await ctx.db.query('comments').paginate({
			numItems: pageSize,
			cursor
		});
		await onBatch(lastBatch.page, lastBatch);
		cursor = lastBatch.isDone ? null : lastBatch.continueCursor;
	} while (cursor);

	return lastBatch;
}

/** Count active (non-hard-deleted) comments grouped by page URL. */
export async function countActiveCommentsByUrl(ctx, pageSize = 500) {
	const counts = new Map();

	await paginateCommentBatches(ctx, {
		pageSize,
		onBatch: async (page) => {
			for (const doc of page) {
				if (doc.deletedAt !== null) continue;
				counts.set(doc.url, (counts.get(doc.url) ?? 0) + 1);
			}
		}
	});

	return counts;
}

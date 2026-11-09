async function paginateCommentBatches(ctx, { pageSize, onBatch }) {
	let cursor = null;
	let lastBatch;

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

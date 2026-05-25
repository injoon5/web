/** Score from denormalized counts (legacy rows without counts sort as 0 until backfill). */
export function commentScore(doc) {
	return (doc.upvotes ?? 0) - (doc.downvotes ?? 0);
}

/** Vote counts from the comment doc when denormalized fields exist. */
export function voteCountsFromDoc(doc) {
	if (doc.upvotes === undefined || doc.downvotes === undefined) return null;
	return { upvotes: doc.upvotes, downvotes: doc.downvotes };
}

/** Count all votes for a comment (source of truth for denormalized fields). */
export async function countAllVotes(ctx, commentId) {
	const votes = await ctx.db
		.query('commentVotes')
		.withIndex('by_comment', (q) => q.eq('commentId', commentId))
		.collect();

	let upvotes = 0;
	let downvotes = 0;
	for (const vote of votes) {
		if (vote.voteType === 'up') upvotes++;
		else downvotes++;
	}
	return { upvotes, downvotes };
}

/** All vote rows for one visitor on a comment (normally 0–1; dedupe races). */
async function votesForVisitor(ctx, commentId, ipHash) {
	return ctx.db
		.query('commentVotes')
		.withIndex('by_comment_ip', (q) => q.eq('commentId', commentId).eq('ipHash', ipHash))
		.collect();
}

/**
 * Apply a vote toggle/switch, then set denormalized counts from the votes table.
 * Recounting after the write avoids lost updates when mutations overlap on counts.
 */
export async function applyVoteChange(ctx, comment, voteType, ipHash) {
	const commentId = comment._id;
	const rows = await votesForVisitor(ctx, commentId, ipHash);
	let existing = rows[0] ?? null;

	for (let i = 1; i < rows.length; i++) {
		await ctx.db.delete(rows[i]._id);
	}

	if (existing && existing.voteType === voteType) {
		await ctx.db.delete(existing._id);
		existing = null;
	} else if (existing) {
		await ctx.db.patch(existing._id, { voteType });
	} else {
		await ctx.db.insert('commentVotes', { commentId, ipHash, voteType });
	}

	const { upvotes, downvotes } = await countAllVotes(ctx, commentId);
	await ctx.db.patch(commentId, { upvotes, downvotes });

	const after = await votesForVisitor(ctx, commentId, ipHash);
	const myVote = after[0]?.voteType ?? null;

	return { upvotes, downvotes, myVote };
}

/** Read denormalized vote counts from the comment doc, with live fallback. */
export async function getVoteCounts(ctx, doc, ipHash) {
	let myVote = null;
	if (ipHash) {
		const rows = await votesForVisitor(ctx, doc._id, ipHash);
		myVote = rows[0]?.voteType ?? null;
	}

	if (doc.upvotes !== undefined && doc.downvotes !== undefined) {
		return { upvotes: doc.upvotes, downvotes: doc.downvotes, myVote };
	}

	const { upvotes, downvotes } = await countAllVotes(ctx, doc._id);
	return { upvotes, downvotes, myVote };
}

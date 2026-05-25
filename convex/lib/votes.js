/** Score from denormalized counts (legacy rows without counts sort as 0 until backfill). */
export function commentScore(doc) {
	return (doc.upvotes ?? 0) - (doc.downvotes ?? 0);
}

/** Vote counts from the comment doc when denormalized fields exist. */
export function voteCountsFromDoc(doc) {
	if (doc.upvotes === undefined || doc.downvotes === undefined) return null;
	return { upvotes: doc.upvotes, downvotes: doc.downvotes };
}

/** Read denormalized vote counts from the comment doc, with live fallback. */
export async function getVoteCounts(ctx, doc, ipHash) {
	let myVote = null;
	if (ipHash) {
		const mine = await ctx.db
			.query('commentVotes')
			.withIndex('by_comment_ip', (q) => q.eq('commentId', doc._id).eq('ipHash', ipHash))
			.unique();
		myVote = mine?.voteType ?? null;
	}

	if (doc.upvotes !== undefined && doc.downvotes !== undefined) {
		return { upvotes: doc.upvotes, downvotes: doc.downvotes, myVote };
	}

	const votes = await ctx.db
		.query('commentVotes')
		.withIndex('by_comment', (q) => q.eq('commentId', doc._id))
		.collect();

	let upvotes = 0;
	let downvotes = 0;
	for (const vote of votes) {
		if (vote.voteType === 'up') upvotes++;
		else downvotes++;
	}

	return { upvotes, downvotes, myVote };
}

/** Count all votes for a comment (backfill / first write on legacy rows). */
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

/** Ensure denormalized counts exist, then apply a vote change delta. */
export async function applyVoteChange(ctx, comment, existing, voteType, ipHash) {
	let upvotes = comment.upvotes;
	let downvotes = comment.downvotes;

	if (upvotes === undefined || downvotes === undefined) {
		({ upvotes, downvotes } = await countAllVotes(ctx, comment._id));
	}

	if (existing && existing.voteType === voteType) {
		await ctx.db.delete(existing._id);
		if (voteType === 'up') upvotes--;
		else downvotes--;
	} else if (existing) {
		await ctx.db.patch(existing._id, { voteType });
		if (existing.voteType === 'up') upvotes--;
		else downvotes--;
		if (voteType === 'up') upvotes++;
		else downvotes--;
	} else {
		await ctx.db.insert('commentVotes', {
			commentId: comment._id,
			ipHash,
			voteType
		});
		if (voteType === 'up') upvotes++;
		else downvotes--;
	}

	await ctx.db.patch(comment._id, { upvotes, downvotes });
	return { upvotes, downvotes };
}

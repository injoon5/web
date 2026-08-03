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
		.withIndex('by_comment_ip', (q) => q.eq('commentId', commentId))
		.collect();

	let upvotes = 0;
	let downvotes = 0;
	for (const vote of votes) {
		if (vote.voteType === 'up') upvotes++;
		else downvotes++;
	}
	return { upvotes, downvotes };
}

/**
 * Map of commentId -> voteType for everything one visitor has voted on.
 * One `by_ip` index scan instead of a `by_comment_ip` lookup per comment,
 * bounded by the visitor's own vote count.
 */
export async function visitorVoteMap(ctx, ipHash) {
	const map = new Map();
	if (!ipHash) return map;

	const rows = await ctx.db
		.query('commentVotes')
		.withIndex('by_ip', (q) => q.eq('ipHash', ipHash))
		.collect();
	for (const row of rows) {
		map.set(row.commentId, row.voteType);
	}
	return map;
}

/** All vote rows for one visitor on a comment (normally 0–1; dedupe races). */
async function votesForVisitor(ctx, commentId, ipHash) {
	return ctx.db
		.query('commentVotes')
		.withIndex('by_comment_ip', (q) => q.eq('commentId', commentId).eq('ipHash', ipHash))
		.collect();
}

/**
 * Apply a vote toggle/switch and move the denormalized counts by what changed.
 *
 * The counts are stepped by a delta rather than recounted. Convex mutations are
 * serializable transactions, so a read-modify-write of `upvotes` cannot lose an
 * update — a conflicting writer retries. Recounting was not buying safety, and
 * it cost a read of every vote row on the comment per vote: a comment with 500
 * votes paid 500 reads to record one. It also widened the transaction's read set
 * to that whole range, which makes OCC conflicts *more* likely, not less.
 *
 * Rows written before the backfill carry no counts, so those fall back to one
 * count — after the writes, which is the value they should have been storing.
 */
export async function applyVoteChange(ctx, comment, voteType, ipHash) {
	const commentId = comment._id;
	const rows = await votesForVisitor(ctx, commentId, ipHash);
	const existing = rows[0] ?? null;

	let up = 0;
	let down = 0;
	const step = (type, by) => {
		if (type === 'up') up += by;
		else down += by;
	};

	// Dedupe stray rows from a past race, backing each out of the counts.
	for (let i = 1; i < rows.length; i++) {
		await ctx.db.delete('commentVotes', rows[i]._id);
		step(rows[i].voteType, -1);
	}

	let myVote;
	if (existing && existing.voteType === voteType) {
		await ctx.db.delete('commentVotes', existing._id);
		step(voteType, -1);
		myVote = null;
	} else if (existing) {
		await ctx.db.patch('commentVotes', existing._id, { voteType });
		step(existing.voteType, -1);
		step(voteType, 1);
		myVote = voteType;
	} else {
		await ctx.db.insert('commentVotes', { commentId, ipHash, voteType });
		step(voteType, 1);
		myVote = voteType;
	}

	const cached = voteCountsFromDoc(comment);
	const counts = cached
		? {
				// A stored count that drifted below zero would otherwise stick there.
				upvotes: Math.max(0, cached.upvotes + up),
				downvotes: Math.max(0, cached.downvotes + down)
			}
		: await countAllVotes(ctx, commentId);

	await ctx.db.patch('comments', commentId, counts);

	return { ...counts, myVote };
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

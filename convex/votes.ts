import { v } from 'convex/values';
import { mutation } from './_generated/server';

// Toggle vote on a comment (same vote = remove, different = switch, new = add)
// Returns updated vote counts and the caller's current vote state
export const toggleVote = mutation({
	args: {
		commentId: v.id('comments'),
		ipHash: v.string(),
		voteType: v.union(v.literal('up'), v.literal('down'))
	},
	handler: async (ctx, { commentId, ipHash, voteType }) => {
		// Verify comment exists and is not deleted
		const comment = await ctx.db.get(commentId);
		if (!comment || comment.deletedAt !== undefined) {
			throw new Error('Comment not found');
		}

		// Find existing vote from this IP
		const existing = await ctx.db
			.query('comment_votes')
			.withIndex('by_comment_and_ip', (q) =>
				q.eq('commentId', commentId).eq('ipHash', ipHash)
			)
			.first();

		if (existing) {
			if (existing.voteType === voteType) {
				// Same vote type — toggle off
				await ctx.db.delete(existing._id);
			} else {
				// Different vote type — switch direction
				await ctx.db.patch(existing._id, { voteType });
			}
		} else {
			// No existing vote — add new one
			await ctx.db.insert('comment_votes', { commentId, ipHash, voteType });
		}

		// Return updated counts
		const allVotes = await ctx.db
			.query('comment_votes')
			.withIndex('by_comment', (q) => q.eq('commentId', commentId))
			.collect();

		const upvotes = allVotes.filter((v) => v.voteType === 'up').length;
		const downvotes = allVotes.filter((v) => v.voteType === 'down').length;
		const myVoteEntry = allVotes.find((v) => v.ipHash === ipHash);
		const myVote = myVoteEntry ? myVoteEntry.voteType : null;

		return { upvotes, downvotes, myVote };
	}
});

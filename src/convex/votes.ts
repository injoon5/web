import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { ConvexError } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { rateLimiter } from './rateLimiter';

// Toggles a vote on a comment. Includes ban check and rate limiting.
// Returns updated upvotes, downvotes, and the user's current vote state.
export const voteOnComment = mutation({
	args: {
		commentId: v.string(),
		ipHash: v.string(),
		voteType: v.union(v.literal('up'), v.literal('down'))
	},
	handler: async (ctx, { commentId, ipHash, voteType }) => {
		const ban = await ctx.db
			.query('bannedIps')
			.withIndex('by_ip', (q) => q.eq('ipHash', ipHash))
			.unique();
		if (ban) throw new ConvexError({ code: 'BANNED', message: 'You have been banned' });

		const { ok, retryAfter } = await rateLimiter.limit(ctx, 'vote', { key: ipHash });
		if (!ok) throw new ConvexError({ code: 'RATE_LIMITED', retryAfter: retryAfter ?? 0 });

		const comment = await ctx.db.get(commentId as Id<'comments'>);
		if (!comment || comment.deletedAt !== undefined) throw new Error('Comment not found');

		const existingVote = await ctx.db
			.query('commentVotes')
			.withIndex('by_comment_and_ip', (q) =>
				q.eq('commentId', commentId as Id<'comments'>).eq('ipHash', ipHash)
			)
			.unique();

		let upvotes = comment.upvotes;
		let downvotes = comment.downvotes;
		let myVote: string | null = null;

		if (existingVote?.voteType === voteType) {
			// Toggle off
			await ctx.db.delete(existingVote._id);
			if (voteType === 'up') upvotes--;
			else downvotes--;
		} else if (existingVote) {
			// Switch direction
			await ctx.db.patch(existingVote._id, { voteType });
			if (voteType === 'up') {
				upvotes++;
				downvotes--;
			} else {
				downvotes++;
				upvotes--;
			}
			myVote = voteType;
		} else {
			// New vote
			await ctx.db.insert('commentVotes', {
				commentId: commentId as Id<'comments'>,
				ipHash,
				voteType
			});
			if (voteType === 'up') upvotes++;
			else downvotes++;
			myVote = voteType;
		}

		await ctx.db.patch(commentId as Id<'comments'>, { upvotes, downvotes });
		return { upvotes, downvotes, myVote };
	}
});

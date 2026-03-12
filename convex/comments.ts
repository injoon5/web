import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

// Public: get comments with vote aggregation for a page URL
export const getPublicComments = query({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => {
		const allComments = await ctx.db
			.query('comments')
			.withIndex('by_url', (q) => q.eq('url', url))
			.filter((q) => q.eq(q.field('deletedAt'), undefined))
			.collect();

		const results = await Promise.all(
			allComments.map(async (comment) => {
				const votes = await ctx.db
					.query('comment_votes')
					.withIndex('by_comment', (q) => q.eq('commentId', comment._id))
					.collect();

				const upvotes = votes.filter((v) => v.voteType === 'up').length;
				const downvotes = votes.filter((v) => v.voteType === 'down').length;
				const score = upvotes - downvotes;
				const myVoteEntry = votes.find((v) => v.ipHash === ipHash);
				const myVote = myVoteEntry ? myVoteEntry.voteType : null;

				return {
					id: comment._id,
					url: comment.url,
					username: comment.username,
					text: comment.text,
					reply: comment.reply ?? null,
					parentId: comment.parentId ?? null,
					depth: comment.depth,
					createdAt: new Date(comment.createdAt).toISOString(),
					updatedAt: new Date(comment.updatedAt).toISOString(),
					upvotes,
					downvotes,
					score,
					myVote
				};
			})
		);

		// Sort by score desc, then createdAt desc (matches original SQL ORDER BY)
		return results.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	}
});

// Admin: get comments for a URL with vote counts (active only)
export const getAdminComments = query({
	args: { url: v.string() },
	handler: async (ctx, { url }) => {
		const allComments = await ctx.db
			.query('comments')
			.withIndex('by_url', (q) => q.eq('url', url))
			.filter((q) => q.eq(q.field('deletedAt'), undefined))
			.collect();

		const results = await Promise.all(
			allComments.map(async (comment) => {
				const votes = await ctx.db
					.query('comment_votes')
					.withIndex('by_comment', (q) => q.eq('commentId', comment._id))
					.collect();

				const upvotes = votes.filter((v) => v.voteType === 'up').length;
				const downvotes = votes.filter((v) => v.voteType === 'down').length;

				return {
					id: comment._id,
					url: comment.url,
					username: comment.username,
					text: comment.text,
					ipHash: comment.ipHash,
					parentId: comment.parentId ?? null,
					depth: comment.depth,
					reply: comment.reply ?? null,
					createdAt: new Date(comment.createdAt).toISOString(),
					updatedAt: new Date(comment.updatedAt).toISOString(),
					upvotes,
					downvotes
				};
			})
		);

		// Sort by createdAt asc (matches original SQL ORDER BY)
		return results.sort(
			(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		);
	}
});

// Admin: get list of URLs with comment counts
export const getAdminUrls = query({
	args: {},
	handler: async (ctx) => {
		const allComments = await ctx.db
			.query('comments')
			.filter((q) => q.eq(q.field('deletedAt'), undefined))
			.collect();

		const urlCounts: Record<string, number> = {};
		for (const comment of allComments) {
			urlCounts[comment.url] = (urlCounts[comment.url] ?? 0) + 1;
		}

		return Object.entries(urlCounts)
			.map(([url, count]) => ({ url, count }))
			.sort((a, b) => b.count - a.count);
	}
});

// Get a single active comment by ID (for PATCH/DELETE password verification)
export const getById = query({
	args: { id: v.id('comments') },
	handler: async (ctx, { id }) => {
		const comment = await ctx.db.get(id);
		if (!comment || comment.deletedAt !== undefined) return null;
		return {
			id: comment._id,
			passwordHash: comment.passwordHash,
			text: comment.text,
			username: comment.username
		};
	}
});

// Get parent comment for depth validation on reply creation
export const getParentForDepthCheck = query({
	args: { id: v.id('comments') },
	handler: async (ctx, { id }) => {
		const comment = await ctx.db.get(id);
		if (!comment || comment.deletedAt !== undefined) return null;
		return { id: comment._id, depth: comment.depth };
	}
});

// Create a new comment
export const create = mutation({
	args: {
		url: v.string(),
		username: v.string(),
		passwordHash: v.string(),
		text: v.string(),
		ipHash: v.string(),
		parentId: v.optional(v.id('comments')),
		depth: v.number()
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const id = await ctx.db.insert('comments', {
			url: args.url,
			username: args.username,
			passwordHash: args.passwordHash,
			text: args.text,
			ipHash: args.ipHash,
			parentId: args.parentId,
			depth: args.depth,
			createdAt: now,
			updatedAt: now
		});

		const comment = await ctx.db.get(id);
		if (!comment) throw new Error('Failed to create comment');

		return {
			id: comment._id,
			url: comment.url,
			username: comment.username,
			text: comment.text,
			reply: comment.reply ?? null,
			parentId: comment.parentId ?? null,
			depth: comment.depth,
			createdAt: new Date(comment.createdAt).toISOString(),
			updatedAt: new Date(comment.updatedAt).toISOString()
		};
	}
});

// Edit comment text (password already verified in API route)
export const editText = mutation({
	args: { id: v.id('comments'), text: v.string() },
	handler: async (ctx, { id, text }) => {
		const now = Date.now();
		await ctx.db.patch(id, { text, updatedAt: now });
		const updated = await ctx.db.get(id);
		if (!updated) throw new Error('Comment not found');
		return {
			id: updated._id,
			text: updated.text,
			updatedAt: new Date(updated.updatedAt).toISOString()
		};
	}
});

// Soft delete (user path): set text + username to [deleted]
export const softDelete = mutation({
	args: { id: v.id('comments') },
	handler: async (ctx, { id }) => {
		await ctx.db.patch(id, {
			text: '[deleted]',
			username: '[deleted]',
			updatedAt: Date.now()
		});
	}
});

// Hard delete (admin path): set deletedAt
export const hardDelete = mutation({
	args: { id: v.id('comments') },
	handler: async (ctx, { id }) => {
		await ctx.db.patch(id, { deletedAt: Date.now() });
	}
});

// Admin soft delete (redact without hiding from tree)
export const adminSoftDelete = mutation({
	args: { id: v.id('comments') },
	handler: async (ctx, { id }) => {
		await ctx.db.patch(id, {
			text: '[deleted]',
			username: '[deleted]',
			updatedAt: Date.now()
		});
	}
});

// Set or clear admin reply
export const setReply = mutation({
	args: { id: v.id('comments'), reply: v.optional(v.string()) },
	handler: async (ctx, { id, reply }) => {
		await ctx.db.patch(id, { reply: reply ?? undefined });
	}
});

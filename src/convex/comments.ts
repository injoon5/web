import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

// Public query used by useQuery in CommentsSection for real-time updates.
// Returns all active comments for a URL, sorted by score desc then createdAt desc.
export const getComments = query({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => {
		const allComments = await ctx.db
			.query('comments')
			.withIndex('by_url', (q) => q.eq('url', url))
			.filter((q) => q.eq(q.field('deletedAt'), undefined))
			.collect();

		// Fetch all votes for this user in one pass to avoid N+1
		const userVotes = ipHash
			? await ctx.db
					.query('commentVotes')
					.withIndex('by_ip', (q) => q.eq('ipHash', ipHash))
					.collect()
			: [];
		const myVotesMap = new Map(userVotes.map((v) => [v.commentId as string, v.voteType]));

		const result = allComments.map((comment) => ({
			id: comment._id as string,
			url: comment.url,
			username: comment.username,
			text: comment.text,
			reply: comment.reply ?? null,
			parentId: (comment.parentId as string | undefined) ?? null,
			depth: comment.depth,
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			upvotes: comment.upvotes,
			downvotes: comment.downvotes,
			score: comment.upvotes - comment.downvotes,
			myVote: myVotesMap.get(comment._id as string) ?? null
		}));

		result.sort((a, b) => {
			const scoreDiff = b.score - a.score;
			if (scoreDiff !== 0) return scoreDiff;
			return b.createdAt - a.createdAt;
		});

		return result;
	}
});

// Single comment lookup used to validate parent when creating a reply.
export const getComment = query({
	args: { id: v.string() },
	handler: async (ctx, { id }) => {
		const comment = await ctx.db.get(id as Id<'comments'>);
		if (!comment || comment.deletedAt !== undefined) return null;
		return { id: comment._id as string, depth: comment.depth };
	}
});

// Returns passwordHash for bcrypt comparison in edit/delete routes. Not exposed to browser.
export const getCommentForEdit = query({
	args: { id: v.string() },
	handler: async (ctx, { id }) => {
		const comment = await ctx.db.get(id as Id<'comments'>);
		if (!comment || comment.deletedAt !== undefined) return null;
		return { id: comment._id as string, passwordHash: comment.passwordHash };
	}
});

// Admin query — returns all active comments for a URL with ipHash and vote counts.
export const getAdminComments = query({
	args: { url: v.string() },
	handler: async (ctx, { url }) => {
		const allComments = await ctx.db
			.query('comments')
			.withIndex('by_url', (q) => q.eq('url', url))
			.filter((q) => q.eq(q.field('deletedAt'), undefined))
			.collect();

		const result = allComments.map((comment) => ({
			id: comment._id as string,
			url: comment.url,
			username: comment.username,
			text: comment.text,
			ipHash: comment.ipHash,
			parentId: (comment.parentId as string | undefined) ?? null,
			depth: comment.depth,
			reply: comment.reply ?? null,
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			upvotes: comment.upvotes,
			downvotes: comment.downvotes
		}));

		result.sort((a, b) => a.createdAt - b.createdAt);
		return result;
	}
});

// Admin query — returns all URLs that have comments, with comment counts.
export const getUrlsWithCounts = query({
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

// Creates a new comment. Ban check is enforced here.
export const createComment = mutation({
	args: {
		url: v.string(),
		username: v.string(),
		passwordHash: v.string(),
		text: v.string(),
		ipHash: v.string(),
		parentId: v.optional(v.string()),
		depth: v.number()
	},
	handler: async (ctx, args) => {
		const ban = await ctx.db
			.query('bannedIps')
			.withIndex('by_ip', (q) => q.eq('ipHash', args.ipHash))
			.unique();
		if (ban) throw new Error('You have been banned from commenting');

		const now = Date.now();
		const id = await ctx.db.insert('comments', {
			url: args.url,
			username: args.username,
			passwordHash: args.passwordHash,
			text: args.text,
			ipHash: args.ipHash,
			parentId: args.parentId as Id<'comments'> | undefined,
			depth: args.depth,
			upvotes: 0,
			downvotes: 0,
			createdAt: now,
			updatedAt: now
		});

		const comment = await ctx.db.get(id);
		return {
			id: comment!._id as string,
			url: comment!.url,
			username: comment!.username,
			text: comment!.text,
			reply: comment!.reply ?? null,
			parentId: (comment!.parentId as string | undefined) ?? null,
			depth: comment!.depth,
			createdAt: comment!.createdAt,
			updatedAt: comment!.updatedAt
		};
	}
});

// Updates a comment's text. Password is verified by the SvelteKit route before calling this.
export const editComment = mutation({
	args: { id: v.string(), text: v.string() },
	handler: async (ctx, { id, text }) => {
		const updatedAt = Date.now();
		await ctx.db.patch(id as Id<'comments'>, { text, updatedAt });
		const comment = await ctx.db.get(id as Id<'comments'>);
		return {
			id: comment!._id as string,
			text: comment!.text,
			updatedAt: comment!.updatedAt
		};
	}
});

// Soft-delete: sets text + username to '[deleted]', preserves thread structure.
export const softDeleteComment = mutation({
	args: { id: v.string() },
	handler: async (ctx, { id }) => {
		await ctx.db.patch(id as Id<'comments'>, {
			text: '[deleted]',
			username: '[deleted]',
			updatedAt: Date.now()
		});
	}
});

// Hard-delete: sets deletedAt, filtered from all public queries.
export const hardDeleteComment = mutation({
	args: { id: v.string() },
	handler: async (ctx, { id }) => {
		await ctx.db.patch(id as Id<'comments'>, { deletedAt: Date.now() });
	}
});

// Sets or clears the admin reply on a comment.
export const setAdminReply = mutation({
	args: { id: v.string(), reply: v.optional(v.string()) },
	handler: async (ctx, { id, reply }) => {
		await ctx.db.patch(id as Id<'comments'>, { reply: reply ?? undefined });
	}
});

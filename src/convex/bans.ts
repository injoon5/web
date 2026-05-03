import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

export const getBans = query({
	args: {},
	handler: async (ctx) => {
		const bans = await ctx.db.query('bannedIps').collect();
		return bans
			.map((b) => ({
				id: b._id as string,
				ipHash: b.ipHash,
				reason: b.reason ?? null,
				createdAt: b.createdAt
			}))
			.sort((a, b) => b.createdAt - a.createdAt);
	}
});

// Looks up ipHash of a comment and bans it; updates reason if already banned.
export const banByCommentId = mutation({
	args: { commentId: v.string(), reason: v.optional(v.string()) },
	handler: async (ctx, { commentId, reason }) => {
		const comment = await ctx.db.get(commentId as Id<'comments'>);
		if (!comment) throw new Error('Comment not found');

		const existing = await ctx.db
			.query('bannedIps')
			.withIndex('by_ip', (q) => q.eq('ipHash', comment.ipHash))
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, { reason: reason ?? undefined });
			const updated = await ctx.db.get(existing._id);
			return {
				id: updated!._id as string,
				ipHash: updated!.ipHash,
				reason: updated!.reason ?? null,
				createdAt: updated!.createdAt
			};
		}

		const id = await ctx.db.insert('bannedIps', {
			ipHash: comment.ipHash,
			reason: reason ?? undefined,
			createdAt: Date.now()
		});
		const ban = await ctx.db.get(id);
		return {
			id: ban!._id as string,
			ipHash: ban!.ipHash,
			reason: ban!.reason ?? null,
			createdAt: ban!.createdAt
		};
	}
});

export const deleteBan = mutation({
	args: { id: v.string() },
	handler: async (ctx, { id }) => {
		await ctx.db.delete(id as Id<'bannedIps'>);
	}
});

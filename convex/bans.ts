import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

// List all banned IPs ordered by createdAt desc
export const getBans = query({
	args: {},
	handler: async (ctx) => {
		const bans = await ctx.db.query('banned_ips').collect();
		return bans
			.map((ban) => ({
				id: ban._id,
				ipHash: ban.ipHash,
				reason: ban.reason ?? null,
				createdAt: new Date(ban.createdAt).toISOString()
			}))
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	}
});

// Check whether an IP hash is currently banned
export const checkBan = query({
	args: { ipHash: v.string() },
	handler: async (ctx, { ipHash }) => {
		const ban = await ctx.db
			.query('banned_ips')
			.withIndex('by_ip_hash', (q) => q.eq('ipHash', ipHash))
			.first();
		return ban !== null;
	}
});

// Look up the IP hash of a comment (for creating a ban from a commentId)
export const getCommentIpHash = query({
	args: { commentId: v.id('comments') },
	handler: async (ctx, { commentId }) => {
		const comment = await ctx.db.get(commentId);
		if (!comment) return null;
		return comment.ipHash;
	}
});

// Create or update a ban for an IP hash (upsert: updates reason if already banned)
export const createBan = mutation({
	args: {
		ipHash: v.string(),
		reason: v.optional(v.string())
	},
	handler: async (ctx, { ipHash, reason }) => {
		const existing = await ctx.db
			.query('banned_ips')
			.withIndex('by_ip_hash', (q) => q.eq('ipHash', ipHash))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, { reason });
			const updated = await ctx.db.get(existing._id);
			if (!updated) throw new Error('Ban not found after update');
			return {
				id: updated._id,
				ipHash: updated.ipHash,
				reason: updated.reason ?? null,
				createdAt: new Date(updated.createdAt).toISOString()
			};
		}

		const now = Date.now();
		const id = await ctx.db.insert('banned_ips', { ipHash, reason, createdAt: now });
		return {
			id,
			ipHash,
			reason: reason ?? null,
			createdAt: new Date(now).toISOString()
		};
	}
});

// Remove a ban by its ID
export const deleteBan = mutation({
	args: { id: v.id('banned_ips') },
	handler: async (ctx, { id }) => {
		await ctx.db.delete(id);
	}
});

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { assertAdmin } from './lib/auth.js';

export const get = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query('nowPage').first();
	}
});

export const update = mutation({
	args: {
		content: v.string(),
		adminSecret: v.string()
	},
	handler: async (ctx, args) => {
		assertAdmin(args.adminSecret);
		const existing = await ctx.db.query('nowPage').first();
		if (existing) {
			await ctx.db.patch(existing._id, {
				content: args.content,
				updatedAt: Date.now()
			});
		} else {
			await ctx.db.insert('nowPage', {
				content: args.content,
				updatedAt: Date.now()
			});
		}
	}
});

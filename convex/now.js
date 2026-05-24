import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { assertAdmin } from './lib/auth.js';

export const get = query({
	args: {},
	handler: async (ctx) => {
		const docs = await ctx.db.query('nowPage').take(1);
		return docs[0] ?? null;
	}
});

export const update = mutation({
	args: {
		content: v.string(),
		adminSecret: v.string()
	},
	handler: async (ctx, args) => {
		assertAdmin(args.adminSecret);
		const docs = await ctx.db.query('nowPage').take(1);
		if (docs.length > 0) {
			await ctx.db.patch(docs[0]._id, {
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

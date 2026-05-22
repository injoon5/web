import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const get = query({
	args: {},
	handler: async (ctx) => {
		const docs = await ctx.db.query('nowPage').take(1);
		return docs[0] ?? null;
	}
});

export const update = mutation({
	args: {
		content: v.string()
	},
	handler: async (ctx, args) => {
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

import { query, mutation } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { assertAdmin } from './lib/auth.js';

const MAX_CONTENT_LENGTH = 20000;

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
		if (args.content.length > MAX_CONTENT_LENGTH) {
			throw new ConvexError({ kind: 'BadRequest', message: 'Now page content is too long' });
		}

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

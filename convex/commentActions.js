'use node';

import bcrypt from 'bcryptjs';
import { ConvexError, v } from 'convex/values';
import { action } from './_generated/server.js';
import { internal } from './_generated/api.js';
import { isAdmin } from './lib/auth.js';

async function requirePassword(ctx, commentId, password) {
	const auth = await ctx.runQuery(internal.comments.getCommentAuth, { commentId });
	if (!auth || auth.deletedAt !== null) {
		throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
	}
	const valid = await bcrypt.compare(password, auth.passwordHash);
	if (!valid) {
		throw new ConvexError({ kind: 'Unauthorized', message: 'Incorrect password' });
	}
}

export const editComment = action({
	args: {
		commentId: v.id('comments'),
		text: v.string(),
		password: v.string(),
		ipHash: v.string(),
		adminSecret: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const admin = await isAdmin(args.adminSecret);

		if (!admin) {
			await ctx.runMutation(internal.comments.consumeEditRateLimit, { ipHash: args.ipHash });
			await requirePassword(ctx, args.commentId, args.password);
		}

		return await ctx.runMutation(internal.comments.applyEdit, {
			commentId: args.commentId,
			text: args.text
		});
	}
});

export const softDeleteComment = action({
	args: {
		commentId: v.id('comments'),
		password: v.optional(v.string()),
		ipHash: v.string(),
		adminSecret: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const admin = await isAdmin(args.adminSecret);

		if (!admin) {
			await ctx.runMutation(internal.comments.consumeEditRateLimit, { ipHash: args.ipHash });
			if (!args.password) {
				throw new ConvexError({ kind: 'Unauthorized', message: 'Incorrect password' });
			}
			await requirePassword(ctx, args.commentId, args.password);
		}

		await ctx.runMutation(internal.comments.softDelete, {
			commentId: args.commentId
		});

		return { success: true };
	}
});

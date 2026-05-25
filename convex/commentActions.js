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

/** Rate limit + password for non-admin callers. */
async function authorizeOwner(ctx, { commentId, password, ipHash, adminSecret }) {
	if (await isAdmin(adminSecret)) return;

	await ctx.runMutation(internal.comments.consumeEditRateLimit, { ipHash });

	if (!password) {
		throw new ConvexError({ kind: 'Unauthorized', message: 'Incorrect password' });
	}

	await requirePassword(ctx, commentId, password);
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
		await authorizeOwner(ctx, args);

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
		await authorizeOwner(ctx, args);

		await ctx.runMutation(internal.comments.softDelete, {
			commentId: args.commentId
		});

		return { success: true };
	}
});

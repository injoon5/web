'use node';

import bcrypt from 'bcryptjs';
import { ConvexError, v } from 'convex/values';
import { action } from './_generated/server.js';
import { internal } from './_generated/api.js';
import { isAdmin } from './lib/auth.js';

/** Rate limit + password for non-admin callers. */
async function authorizeOwner(ctx, { commentId, password, ipHash, adminSecret }) {
	if (await isAdmin(adminSecret)) return;

	// One internal mutation consumes the rate-limit token and returns the auth
	// payload, keeping this action's sequential transactional calls to two
	// (this + the actual edit/delete).
	const auth = await ctx.runMutation(internal.comments.beginOwnerAction, { commentId, ipHash });

	if (!password) {
		throw new ConvexError({ kind: 'Unauthorized', message: 'Incorrect password' });
	}
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

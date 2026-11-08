'use node';

import bcrypt from 'bcryptjs';
import { v } from 'convex/values';
import { action } from './_generated/server.js';
import { internal } from './_generated/api.js';
import { isAdmin } from './lib/auth.js';
import { fail } from './lib/errors.js';
import { assertServerCall } from './lib/serverCall.js';
import { visitorWriteArgs } from './lib/visitorWrite.js';

/**
 * Rate limit + password for non-admin callers. The rate limit is what stands
 * between a comment's password and a brute force, and it is keyed on `ipHash`,
 * so only the SvelteKit server may supply one: see lib/serverCall.js.
 *
 * An action, not `beginVisitorWrite`: bcrypt needs Node, and an action cannot
 * read the database itself.
 */
async function authorizeOwner(ctx, { commentId, password, ipHash, adminSecret, serverCredential }) {
	await assertServerCall(serverCredential);
	if (await isAdmin(adminSecret)) return;

	// One internal mutation consumes the rate-limit token and returns the auth
	// payload, keeping this action's sequential transactional calls to two
	// (this + the actual edit/delete).
	const auth = await ctx.runMutation(internal.comments.beginOwnerAction, { commentId, ipHash });
	if (!auth || auth.deletedAt !== null) fail('NotFound', 'Comment not found');
	if (!(await bcrypt.compare(password, auth.passwordHash))) {
		fail('Unauthorized', 'Incorrect password');
	}
}

export const editComment = action({
	args: {
		commentId: v.id('comments'),
		text: v.string(),
		password: v.string(),
		...visitorWriteArgs
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
		password: v.string(),
		ipHash: v.string(),
		serverCredential: v.string()
	},
	handler: async (ctx, args) => {
		await authorizeOwner(ctx, args);
		await ctx.runMutation(internal.comments.softDelete, { commentId: args.commentId });
		return { success: true };
	}
});

'use node';

import bcrypt from 'bcryptjs';
import { v } from 'convex/values';
import { action } from './_generated/server.js';
import { internal } from './_generated/api.js';

export const verifyCommentPassword = action({
	args: {
		commentId: v.id('comments'),
		password: v.string()
	},
	handler: async (ctx, { commentId, password }) => {
		const auth = await ctx.runQuery(internal.comments.getCommentAuth, { commentId });
		if (!auth || auth.deletedAt !== null) return { valid: false, reason: 'not_found' };
		const valid = await bcrypt.compare(password, auth.passwordHash);
		return { valid, reason: valid ? 'ok' : 'invalid' };
	}
});

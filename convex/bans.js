import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server.js';
import { assertAdmin } from './lib/auth.js';
import { publicBan } from './lib/serialize.js';

export const list = query({
	args: { adminSecret: v.string() },
	handler: async (ctx, { adminSecret }) => {
		await assertAdmin(adminSecret);
		const rows = await ctx.db.query('bannedIps').collect();
		rows.sort((a, b) => b._creationTime - a._creationTime);
		return rows.map(publicBan);
	}
});

export const create = mutation({
	args: {
		commentId: v.id('comments'),
		reason: v.optional(v.string()),
		adminSecret: v.string()
	},
	handler: async (ctx, { commentId, reason, adminSecret }) => {
		await assertAdmin(adminSecret);

		const comment = await ctx.db.get('comments', commentId);
		if (!comment) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		const trimmedReason = reason?.trim() || null;

		// Collect (not `.unique()`) so a pre-existing duplicate can't throw; keep
		// the first row, prune any extras, and self-heal the table on write.
		const existingRows = await ctx.db
			.query('bannedIps')
			.withIndex('by_ip', (q) => q.eq('ipHash', comment.ipHash))
			.collect();

		if (existingRows.length > 0) {
			const [keep, ...extras] = existingRows;
			for (const extra of extras) await ctx.db.delete('bannedIps', extra._id);
			await ctx.db.patch('bannedIps', keep._id, { reason: trimmedReason });
			const updated = await ctx.db.get('bannedIps', keep._id);
			return publicBan(updated);
		}

		const id = await ctx.db.insert('bannedIps', {
			ipHash: comment.ipHash,
			reason: trimmedReason
		});
		const doc = await ctx.db.get('bannedIps', id);
		return publicBan(doc);
	}
});

export const remove = mutation({
	args: { banId: v.id('bannedIps'), adminSecret: v.string() },
	handler: async (ctx, { banId, adminSecret }) => {
		await assertAdmin(adminSecret);
		await ctx.db.delete('bannedIps', banId);
	}
});

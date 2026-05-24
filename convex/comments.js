import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server.js';
import { limiter } from './rateLimits.js';
import { assertAdmin, assertServer, isAdmin } from './lib/auth.js';
import { publicComment } from './lib/serialize.js';

const MAX_DEPTH = 2;
const MAX_COMMENTS = 200;
const MAX_USERNAME_LENGTH = 32;
const MAX_TEXT_LENGTH = 200;

async function isBanned(ctx, ipHash) {
	const ban = await ctx.db
		.query('bannedIps')
		.withIndex('by_ip', (q) => q.eq('ipHash', ipHash))
		.unique();
	return ban !== null;
}

async function consumeRateLimit(ctx, name, ipHash) {
	await limiter.limit(ctx, name, { key: ipHash, throws: true });
}

async function aggregateVotes(ctx, commentId, ipHash) {
	const votes = await ctx.db
		.query('commentVotes')
		.withIndex('by_comment', (q) => q.eq('commentId', commentId))
		.collect();

	let upvotes = 0;
	let downvotes = 0;
	let myVote = null;
	for (const v of votes) {
		if (v.voteType === 'up') upvotes++;
		else downvotes++;
		if (ipHash && v.ipHash === ipHash) myVote = v.voteType;
	}
	return { upvotes, downvotes, myVote };
}

export const list = query({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => {
		const docs = await ctx.db
			.query('comments')
			.withIndex('by_url', (q) => q.eq('url', url))
			.collect();

		const active = docs.filter((d) => d.deletedAt === null);

		const enriched = await Promise.all(
			active.map(async (doc) => {
				const counts = await aggregateVotes(ctx, doc._id, ipHash);
				return publicComment(doc, counts);
			})
		);

		enriched.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return b.createdAt - a.createdAt;
		});

		return enriched.slice(0, MAX_COMMENTS);
	}
});

export const getForAuth = query({
	args: { commentId: v.id('comments'), serverSecret: v.string() },
	handler: async (ctx, { commentId, serverSecret }) => {
		assertServer(serverSecret);
		const doc = await ctx.db.get(commentId);
		if (!doc) return null;
		return { passwordHash: doc.passwordHash, deletedAt: doc.deletedAt };
	}
});

export const create = mutation({
	args: {
		url: v.string(),
		username: v.string(),
		passwordHash: v.string(),
		text: v.string(),
		parentId: v.optional(v.id('comments')),
		ipHash: v.string(),
		serverSecret: v.string(),
		adminSecret: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		assertServer(args.serverSecret);
		const admin = isAdmin(args.adminSecret);
		const username = args.username.trim() || 'Anonymous';
		const text = args.text.trim();

		if (
			username.length > MAX_USERNAME_LENGTH ||
			text.length === 0 ||
			text.length > MAX_TEXT_LENGTH
		) {
			throw new ConvexError({ kind: 'BadRequest', message: 'Invalid comment' });
		}

		if (!admin && (await isBanned(ctx, args.ipHash))) {
			throw new ConvexError({ kind: 'Banned' });
		}

		if (!admin) await consumeRateLimit(ctx, 'comment', args.ipHash);

		let depth = 0;
		let parentId = null;
		if (args.parentId) {
			const parent = await ctx.db.get(args.parentId);
			if (!parent || parent.deletedAt !== null) {
				throw new ConvexError({ kind: 'NotFound', message: 'Parent comment not found' });
			}
			if (parent.depth >= MAX_DEPTH) {
				throw new ConvexError({ kind: 'BadRequest', message: 'Maximum reply depth reached' });
			}
			if (parent.url !== args.url) {
				throw new ConvexError({
					kind: 'BadRequest',
					message: 'Parent comment belongs to another page'
				});
			}
			depth = parent.depth + 1;
			parentId = args.parentId;
		}

		const id = await ctx.db.insert('comments', {
			url: args.url,
			username,
			passwordHash: args.passwordHash,
			text,
			ipHash: args.ipHash,
			parentId,
			depth,
			reply: null,
			updatedAt: null,
			deletedAt: null
		});

		const doc = await ctx.db.get(id);
		return publicComment(doc, { upvotes: 0, downvotes: 0, myVote: null });
	}
});

export const vote = mutation({
	args: {
		commentId: v.id('comments'),
		voteType: v.union(v.literal('up'), v.literal('down')),
		ipHash: v.string(),
		serverSecret: v.string(),
		adminSecret: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		assertServer(args.serverSecret);
		const admin = isAdmin(args.adminSecret);

		if (!admin && (await isBanned(ctx, args.ipHash))) {
			throw new ConvexError({ kind: 'Banned' });
		}

		if (!admin) await consumeRateLimit(ctx, 'vote', args.ipHash);

		const comment = await ctx.db.get(args.commentId);
		if (!comment || comment.deletedAt !== null) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		const existing = await ctx.db
			.query('commentVotes')
			.withIndex('by_comment_ip', (q) =>
				q.eq('commentId', args.commentId).eq('ipHash', args.ipHash)
			)
			.unique();

		if (existing && existing.voteType === args.voteType) {
			await ctx.db.delete(existing._id);
		} else if (existing) {
			await ctx.db.patch(existing._id, { voteType: args.voteType });
		} else {
			await ctx.db.insert('commentVotes', {
				commentId: args.commentId,
				ipHash: args.ipHash,
				voteType: args.voteType
			});
		}

		const { upvotes, downvotes, myVote } = await aggregateVotes(ctx, args.commentId, args.ipHash);
		return { upvotes, downvotes, myVote };
	}
});

export const applyEdit = mutation({
	args: {
		commentId: v.id('comments'),
		text: v.string(),
		ipHash: v.string(),
		serverSecret: v.string(),
		adminSecret: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		assertServer(args.serverSecret);
		const admin = isAdmin(args.adminSecret);
		const text = args.text.trim();

		if (text.length === 0 || text.length > MAX_TEXT_LENGTH) {
			throw new ConvexError({ kind: 'BadRequest', message: 'Invalid comment' });
		}
		if (!admin && (await isBanned(ctx, args.ipHash))) {
			throw new ConvexError({ kind: 'Banned' });
		}
		if (!admin) await consumeRateLimit(ctx, 'edit', args.ipHash);

		const comment = await ctx.db.get(args.commentId);
		if (!comment || comment.deletedAt !== null) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		const updatedAt = Date.now();
		await ctx.db.patch(args.commentId, { text, updatedAt });
		return { id: args.commentId, text, updatedAt };
	}
});

export const softDelete = mutation({
	args: {
		commentId: v.id('comments'),
		serverSecret: v.string()
	},
	handler: async (ctx, { commentId, serverSecret }) => {
		assertServer(serverSecret);
		const comment = await ctx.db.get(commentId);
		if (!comment || comment.deletedAt !== null) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		await ctx.db.patch(commentId, {
			username: '[deleted]',
			text: '[deleted]',
			updatedAt: Date.now()
		});
	}
});

export const hardDelete = mutation({
	args: { commentId: v.id('comments'), adminSecret: v.string() },
	handler: async (ctx, { commentId, adminSecret }) => {
		assertAdmin(adminSecret);

		const votes = await ctx.db
			.query('commentVotes')
			.withIndex('by_comment', (q) => q.eq('commentId', commentId))
			.collect();
		for (const vote of votes) {
			await ctx.db.delete(vote._id);
		}

		await ctx.db.patch(commentId, { deletedAt: Date.now() });
	}
});

export const setReply = mutation({
	args: {
		commentId: v.id('comments'),
		reply: v.string(),
		adminSecret: v.string()
	},
	handler: async (ctx, { commentId, reply, adminSecret }) => {
		assertAdmin(adminSecret);
		const trimmed = reply.trim();
		await ctx.db.patch(commentId, { reply: trimmed || null });
	}
});

import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server.js';
import { limiter } from './rateLimits.js';
import { assertAdmin, isAdmin } from './lib/auth.js';
import { isBanned } from './lib/bans.js';
import { publicComment } from './lib/serialize.js';
import { applyVoteChange, commentScore, getVoteCounts } from './lib/votes.js';
import { decrementUrlCount, incrementUrlCount } from './lib/urlCounts.js';
import { assertIpProof } from './lib/ipProof.js';

const MAX_DEPTH = 2;
const MAX_COMMENTS = 200;
const MAX_TEXT_LENGTH = 200;
const MAX_USERNAME_LENGTH = 32;
const MAX_REPLY_LENGTH = 1000;

async function consumeRateLimit(ctx, name, ipHash) {
	await limiter.limit(ctx, name, { key: ipHash, throws: true });
}

export const consumeEditRateLimit = internalMutation({
	args: { ipHash: v.string() },
	handler: async (ctx, { ipHash }) => {
		await consumeRateLimit(ctx, 'edit', ipHash);
	}
});

export const list = query({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => {
		const docs = await ctx.db
			.query('comments')
			.withIndex('by_url', (q) => q.eq('url', url))
			.collect();

		const active = docs.filter((d) => d.deletedAt === null);

		const byScore = (a, b) => {
			const scoreDiff = commentScore(b) - commentScore(a);
			if (scoreDiff !== 0) return scoreDiff;
			return b._creationTime - a._creationTime;
		};
		active.sort(byScore);

		// Select the top comments by score, but always pull in the ancestors of any
		// selected reply. Slicing the flat list directly could drop a live parent
		// while keeping its child, which the client would then render as an orphan.
		const byId = new Map(active.map((d) => [d._id, d]));
		const selected = new Map();
		const selectWithAncestors = (doc) => {
			let cur = doc;
			while (cur && !selected.has(cur._id)) {
				selected.set(cur._id, cur);
				cur = cur.parentId ? byId.get(cur.parentId) : null;
			}
		};
		for (const doc of active) {
			if (selected.size >= MAX_COMMENTS) break;
			selectWithAncestors(doc);
		}

		const top = [...selected.values()].sort(byScore);

		return await Promise.all(
			top.map(async (doc) => {
				const counts = await getVoteCounts(ctx, doc, ipHash);
				return publicComment(doc, counts);
			})
		);
	}
});

export const getCommentAuth = internalQuery({
	args: { commentId: v.id('comments') },
	handler: async (ctx, { commentId }) => {
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
		ipProof: v.string(),
		adminSecret: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const admin = await isAdmin(args.adminSecret);
		if (!admin) await assertIpProof(args.ipHash, args.ipProof);

		if (await isBanned(ctx, args.ipHash)) {
			throw new ConvexError({ kind: 'Banned' });
		}

		// Enforce limits server-side: this mutation is part of the public Convex
		// API, so direct callers must not be able to bypass the SvelteKit/Zod layer.
		const username = args.username.trim() || 'Anonymous';
		if (args.text.length < 1 || args.text.length > MAX_TEXT_LENGTH) {
			throw new ConvexError({ kind: 'BadRequest', message: 'Comment must be 1-200 characters' });
		}
		if (username.length > MAX_USERNAME_LENGTH) {
			throw new ConvexError({
				kind: 'BadRequest',
				message: 'Username must be 32 characters or less'
			});
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
			depth = parent.depth + 1;
			parentId = args.parentId;
		}

		const id = await ctx.db.insert('comments', {
			url: args.url,
			username,
			passwordHash: args.passwordHash,
			text: args.text,
			ipHash: args.ipHash,
			parentId,
			depth,
			reply: null,
			updatedAt: null,
			deletedAt: null,
			upvotes: 0,
			downvotes: 0
		});

		await incrementUrlCount(ctx, args.url);

		const doc = await ctx.db.get(id);
		return publicComment(doc, { upvotes: 0, downvotes: 0, myVote: null });
	}
});

export const vote = mutation({
	args: {
		commentId: v.id('comments'),
		voteType: v.union(v.literal('up'), v.literal('down')),
		ipHash: v.string(),
		ipProof: v.string(),
		adminSecret: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const admin = await isAdmin(args.adminSecret);
		if (!admin) await assertIpProof(args.ipHash, args.ipProof);

		if (await isBanned(ctx, args.ipHash)) {
			throw new ConvexError({ kind: 'Banned' });
		}

		if (!admin) await consumeRateLimit(ctx, 'vote', args.ipHash);

		const comment = await ctx.db.get(args.commentId);
		if (!comment || comment.deletedAt !== null) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		const { upvotes, downvotes, myVote } = await applyVoteChange(
			ctx,
			comment,
			args.voteType,
			args.ipHash
		);

		return { upvotes, downvotes, myVote };
	}
});

export const applyEdit = internalMutation({
	args: {
		commentId: v.id('comments'),
		text: v.string()
	},
	handler: async (ctx, args) => {
		const comment = await ctx.db.get(args.commentId);
		if (!comment || comment.deletedAt !== null) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		const updatedAt = Date.now();
		await ctx.db.patch(args.commentId, { text: args.text, updatedAt });
		return { id: args.commentId, text: args.text, updatedAt };
	}
});

export const softDelete = internalMutation({
	args: {
		commentId: v.id('comments')
	},
	handler: async (ctx, args) => {
		const comment = await ctx.db.get(args.commentId);
		if (!comment || comment.deletedAt !== null) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		await ctx.db.patch(args.commentId, {
			text: '[deleted]',
			username: '[deleted]',
			updatedAt: Date.now()
		});
	}
});

export const hardDelete = mutation({
	args: { commentId: v.id('comments'), adminSecret: v.string() },
	handler: async (ctx, { commentId, adminSecret }) => {
		await assertAdmin(adminSecret);

		// Already hard-deleted (or missing): descendants and votes were handled by
		// the original call, so a retry/double-click has nothing left to do.
		const root = await ctx.db.get(commentId);
		if (!root || root.deletedAt !== null) return;

		// Recursively collect all descendant comment IDs
		const toDelete = [commentId];
		for (let i = 0; i < toDelete.length; i++) {
			const children = await ctx.db
				.query('comments')
				.withIndex('by_parent', (q) => q.eq('parentId', toDelete[i]))
				.collect();
			for (const child of children) {
				toDelete.push(child._id);
			}
		}

		const now = Date.now();
		for (const id of toDelete) {
			const doc = await ctx.db.get(id);
			if (doc?.deletedAt === null) {
				await decrementUrlCount(ctx, doc.url);
			}

			const votes = await ctx.db
				.query('commentVotes')
				.withIndex('by_comment', (q) => q.eq('commentId', id))
				.collect();
			for (const vote of votes) {
				await ctx.db.delete(vote._id);
			}
			// Set deletedAt
			await ctx.db.patch(id, { deletedAt: now });
		}
	}
});

export const setReply = mutation({
	args: {
		commentId: v.id('comments'),
		reply: v.string(),
		adminSecret: v.string()
	},
	handler: async (ctx, { commentId, reply, adminSecret }) => {
		await assertAdmin(adminSecret);

		const comment = await ctx.db.get(commentId);
		if (!comment || comment.deletedAt !== null) {
			throw new ConvexError({ kind: 'NotFound', message: 'Comment not found' });
		}

		const trimmed = reply.trim();
		if (trimmed.length > MAX_REPLY_LENGTH) {
			throw new ConvexError({
				kind: 'BadRequest',
				message: 'Reply must be 1000 characters or less'
			});
		}

		await ctx.db.patch(commentId, { reply: trimmed || null });
	}
});

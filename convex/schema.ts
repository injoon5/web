import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	comments: defineTable({
		url: v.string(),
		username: v.string(),
		passwordHash: v.string(),
		text: v.string(),
		ipHash: v.string(),
		parentId: v.optional(v.id('comments')),
		depth: v.number(),
		reply: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
		deletedAt: v.optional(v.number())
	})
		.index('by_url', ['url'])
		.index('by_ip_hash', ['ipHash']),

	comment_votes: defineTable({
		commentId: v.id('comments'),
		ipHash: v.string(),
		voteType: v.union(v.literal('up'), v.literal('down'))
	})
		.index('by_comment', ['commentId'])
		.index('by_comment_and_ip', ['commentId', 'ipHash']),

	likes: defineTable({
		url: v.string(),
		ipHash: v.string()
	})
		.index('by_url', ['url'])
		.index('by_url_and_ip', ['url', 'ipHash']),

	banned_ips: defineTable({
		ipHash: v.string(),
		reason: v.optional(v.string()),
		createdAt: v.number()
	}).index('by_ip_hash', ['ipHash'])
});

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
		deletedAt: v.optional(v.number()),
		upvotes: v.number(),
		downvotes: v.number(),
		createdAt: v.number(),
		updatedAt: v.number()
	}).index('by_url', ['url']),

	commentVotes: defineTable({
		commentId: v.id('comments'),
		ipHash: v.string(),
		voteType: v.union(v.literal('up'), v.literal('down'))
	})
		.index('by_comment_and_ip', ['commentId', 'ipHash'])
		.index('by_comment', ['commentId'])
		.index('by_ip', ['ipHash']),

	likes: defineTable({
		url: v.string(),
		ipHash: v.string()
	})
		.index('by_url_and_ip', ['url', 'ipHash'])
		.index('by_url', ['url']),

	bannedIps: defineTable({
		ipHash: v.string(),
		reason: v.optional(v.string()),
		createdAt: v.number()
	}).index('by_ip', ['ipHash'])
});

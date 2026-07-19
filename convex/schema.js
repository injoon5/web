import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	comments: defineTable({
		url: v.string(),
		username: v.string(),
		passwordHash: v.string(),
		text: v.string(),
		ipHash: v.string(),
		parentId: v.union(v.id('comments'), v.null()),
		depth: v.number(),
		reply: v.union(v.string(), v.null()),
		updatedAt: v.union(v.number(), v.null()),
		deletedAt: v.union(v.number(), v.null()),
		upvotes: v.optional(v.number()),
		downvotes: v.optional(v.number())
	})
		.index('by_url', ['url'])
		.index('by_parent', ['parentId']),

	commentUrlCounts: defineTable({
		url: v.string(),
		count: v.number()
	}).index('by_url', ['url']),

	migrationMeta: defineTable({
		key: v.string(),
		complete: v.boolean()
	}).index('by_key', ['key']),

	commentVotes: defineTable({
		commentId: v.id('comments'),
		ipHash: v.string(),
		voteType: v.union(v.literal('up'), v.literal('down'))
	})
		// by_comment_ip also serves plain by-comment scans (index prefix), so a
		// separate by_comment index would be redundant.
		.index('by_comment_ip', ['commentId', 'ipHash'])
		.index('by_ip', ['ipHash']),

	likes: defineTable({
		url: v.string(),
		ipHash: v.string()
	})
		// by_url_ip also serves plain by-url scans (index prefix).
		.index('by_url_ip', ['url', 'ipHash']),

	likeCounts: defineTable({
		url: v.string(),
		count: v.number()
	}).index('by_url', ['url']),

	bannedIps: defineTable({
		ipHash: v.string(),
		reason: v.union(v.string(), v.null())
	}).index('by_ip', ['ipHash']),

	nowPage: defineTable({
		content: v.string(),
		updatedAt: v.number()
	})
});

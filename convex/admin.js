import { v } from 'convex/values';
import { query } from './_generated/server.js';
import { assertAdmin } from './lib/auth.js';
import { adminComment } from './lib/serialize.js';

export const listUrls = query({
	args: { adminSecret: v.string() },
	handler: async (ctx, { adminSecret }) => {
		assertAdmin(adminSecret);

		const all = await ctx.db.query('comments').collect();
		const counts = new Map();
		for (const c of all) {
			if (c.deletedAt !== null) continue;
			counts.set(c.url, (counts.get(c.url) ?? 0) + 1);
		}

		return Array.from(counts.entries())
			.map(([url, count]) => ({ url, count }))
			.sort((a, b) => b.count - a.count);
	}
});

export const listForUrl = query({
	args: { url: v.string(), adminSecret: v.string() },
	handler: async (ctx, { url, adminSecret }) => {
		assertAdmin(adminSecret);

		const docs = await ctx.db
			.query('comments')
			.withIndex('by_url', (q) => q.eq('url', url))
			.collect();

		const active = docs.filter((d) => d.deletedAt === null);

		const enriched = await Promise.all(
			active.map(async (doc) => {
				const votes = await ctx.db
					.query('commentVotes')
					.withIndex('by_comment', (q) => q.eq('commentId', doc._id))
					.collect();
				let upvotes = 0;
				let downvotes = 0;
				for (const v of votes) {
					if (v.voteType === 'up') upvotes++;
					else downvotes++;
				}
				return adminComment(doc, { upvotes, downvotes });
			})
		);

		enriched.sort((a, b) => a.createdAt - b.createdAt);
		return enriched;
	}
});

import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

// Get like count and whether the given IP has liked this URL
export const getLikes = query({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => {
		const allLikes = await ctx.db
			.query('likes')
			.withIndex('by_url', (q) => q.eq('url', url))
			.collect();

		const count = allLikes.length;
		const liked = allLikes.some((l) => l.ipHash === ipHash);

		return { count, liked };
	}
});

// Toggle like for a URL (add if absent, remove if present)
export const toggleLike = mutation({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => {
		const existing = await ctx.db
			.query('likes')
			.withIndex('by_url_and_ip', (q) => q.eq('url', url).eq('ipHash', ipHash))
			.first();

		if (existing) {
			await ctx.db.delete(existing._id);
		} else {
			await ctx.db.insert('likes', { url, ipHash });
		}

		const allLikes = await ctx.db
			.query('likes')
			.withIndex('by_url', (q) => q.eq('url', url))
			.collect();

		return {
			count: allLikes.length,
			liked: !existing
		};
	}
});

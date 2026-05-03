import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { ConvexError } from 'convex/values';
import { rateLimiter } from './rateLimiter';

export const getLikes = query({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => {
		const all = await ctx.db
			.query('likes')
			.withIndex('by_url', (q) => q.eq('url', url))
			.collect();
		const count = all.length;
		const liked = ipHash ? all.some((l) => l.ipHash === ipHash) : false;
		return { count, liked };
	}
});

// Toggles a like for a URL. Includes ban check and rate limiting.
export const toggleLike = mutation({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => {
		const ban = await ctx.db
			.query('bannedIps')
			.withIndex('by_ip', (q) => q.eq('ipHash', ipHash))
			.unique();
		if (ban) throw new ConvexError({ code: 'BANNED', message: 'You have been banned' });

		const { ok, retryAfter } = await rateLimiter.limit(ctx, 'like', { key: ipHash });
		if (!ok) throw new ConvexError({ code: 'RATE_LIMITED', retryAfter: retryAfter ?? 0 });

		const existing = await ctx.db
			.query('likes')
			.withIndex('by_url_and_ip', (q) => q.eq('url', url).eq('ipHash', ipHash))
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
		} else {
			await ctx.db.insert('likes', { url, ipHash });
		}

		const all = await ctx.db
			.query('likes')
			.withIndex('by_url', (q) => q.eq('url', url))
			.collect();
		return { count: all.length, liked: !existing };
	}
});

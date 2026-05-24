import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server.js';
import { limiter } from './rateLimits.js';
import { assertServer, isAdmin } from './lib/auth.js';

async function isBanned(ctx, ipHash) {
	const ban = await ctx.db
		.query('bannedIps')
		.withIndex('by_ip', (q) => q.eq('ipHash', ipHash))
		.unique();
	return ban !== null;
}

async function aggregate(ctx, url, ipHash) {
	const rows = await ctx.db
		.query('likes')
		.withIndex('by_url', (q) => q.eq('url', url))
		.collect();
	return {
		count: rows.length,
		liked: rows.some((r) => r.ipHash === ipHash)
	};
}

export const get = query({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => aggregate(ctx, url, ipHash)
});

export const toggle = mutation({
	args: {
		url: v.string(),
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

		if (!admin) {
			await limiter.limit(ctx, 'like', { key: args.ipHash, throws: true });
		}

		const existing = await ctx.db
			.query('likes')
			.withIndex('by_url_ip', (q) => q.eq('url', args.url).eq('ipHash', args.ipHash))
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
		} else {
			await ctx.db.insert('likes', { url: args.url, ipHash: args.ipHash });
		}

		return aggregate(ctx, args.url, args.ipHash);
	}
});

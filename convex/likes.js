import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server.js';
import { limiter } from './rateLimits.js';
import { isAdmin } from './lib/auth.js';
import { isBanned } from './lib/bans.js';

/** Rows for one visitor on a page (0–1 normally; dedupe races). */
async function likesForVisitor(ctx, url, ipHash) {
	return ctx.db
		.query('likes')
		.withIndex('by_url_ip', (q) => q.eq('url', url).eq('ipHash', ipHash))
		.collect();
}

/** Delete duplicate like rows for the same url+ipHash (parallel toggles). */
async function dedupeLikesForVisitor(ctx, url, ipHash) {
	const rows = await likesForVisitor(ctx, url, ipHash);
	for (let i = 1; i < rows.length; i++) {
		await ctx.db.delete(rows[i]._id);
	}
	return rows[0] ?? null;
}

function aggregateFromRows(rows, ipHash) {
	const seen = new Set();
	for (const row of rows) {
		seen.add(row.ipHash);
	}
	return {
		count: seen.size,
		liked: seen.has(ipHash)
	};
}

async function aggregate(ctx, url, ipHash) {
	const rows = await ctx.db
		.query('likes')
		.withIndex('by_url', (q) => q.eq('url', url))
		.collect();
	return aggregateFromRows(rows, ipHash);
}

export const get = query({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => aggregate(ctx, url, ipHash)
});

export const toggle = mutation({
	args: {
		url: v.string(),
		ipHash: v.string(),
		adminSecret: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const admin = await isAdmin(args.adminSecret);

		if (await isBanned(ctx, args.ipHash)) {
			throw new ConvexError({ kind: 'Banned' });
		}

		if (!admin) {
			await limiter.limit(ctx, 'like', { key: args.ipHash, throws: true });
		}

		const existing = await dedupeLikesForVisitor(ctx, args.url, args.ipHash);

		if (existing) {
			await ctx.db.delete(existing._id);
		} else {
			await ctx.db.insert('likes', { url: args.url, ipHash: args.ipHash });
		}

		await dedupeLikesForVisitor(ctx, args.url, args.ipHash);

		return aggregate(ctx, args.url, args.ipHash);
	}
});

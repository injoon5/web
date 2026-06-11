import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server.js';
import { limiter } from './rateLimits.js';
import { isAdmin } from './lib/auth.js';
import { isBanned } from './lib/bans.js';
import { readLikeCount, syncLikeCountForUrl } from './lib/likeCounts.js';
import { assertIpProof } from './lib/ipProof.js';

async function aggregate(ctx, url, ipHash) {
	const mine = await ctx.db
		.query('likes')
		.withIndex('by_url_ip', (q) => q.eq('url', url).eq('ipHash', ipHash))
		.first();
	return {
		count: await readLikeCount(ctx, url),
		liked: mine !== null
	};
}

export const get = query({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => aggregate(ctx, url, ipHash)
});

export const setLike = mutation({
	args: {
		url: v.string(),
		ipHash: v.string(),
		ipProof: v.string(),
		// Desired state. Omitted falls back to a toggle so older clients keep working.
		liked: v.optional(v.boolean()),
		adminSecret: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const admin = await isAdmin(args.adminSecret);
		if (!admin) await assertIpProof(args.ipHash, args.ipProof);

		if (await isBanned(ctx, args.ipHash)) {
			throw new ConvexError({ kind: 'Banned' });
		}

		const rows = await ctx.db
			.query('likes')
			.withIndex('by_url_ip', (q) => q.eq('url', args.url).eq('ipHash', args.ipHash))
			.collect();

		// Dedup stray rows from a past race so membership is exactly one or zero.
		for (let i = 1; i < rows.length; i++) {
			await ctx.db.delete(rows[i]._id);
		}
		const existing = rows[0] ?? null;
		const currentlyLiked = existing !== null;
		const desired = args.liked ?? !currentlyLiked;

		// Only spend a rate-limit token (and write) when the state actually changes,
		// so idempotent re-sends from the optimistic client are free no-ops.
		if (desired !== currentlyLiked) {
			if (!admin) {
				await limiter.limit(ctx, 'like', { key: args.ipHash, throws: true });
			}

			if (desired) {
				await ctx.db.insert('likes', { url: args.url, ipHash: args.ipHash });
			} else {
				await ctx.db.delete(existing._id);
			}
		}

		await syncLikeCountForUrl(ctx, args.url);

		return aggregate(ctx, args.url, args.ipHash);
	}
});

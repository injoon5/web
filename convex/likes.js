import { v } from 'convex/values';
import { mutation, query } from './_generated/server.js';
import { beginVisitorWrite, visitorWriteArgs } from './lib/visitorWrite.js';
import { adjustCount } from './lib/counter.js';
import { readLikeCount } from './lib/likeCounts.js';

export const get = query({
	args: { url: v.string(), ipHash: v.string() },
	handler: async (ctx, { url, ipHash }) => {
		const mine = await ctx.db
			.query('likes')
			.withIndex('by_url_ip', (q) => q.eq('url', url).eq('ipHash', ipHash))
			.first();
		return { count: await readLikeCount(ctx, url), liked: mine !== null };
	}
});

export const setLike = mutation({
	args: {
		url: v.string(),
		liked: v.boolean(),
		...visitorWriteArgs
	},
	handler: async (ctx, args) => {
		const visitor = await beginVisitorWrite(ctx, args);

		const rows = await ctx.db
			.query('likes')
			.withIndex('by_url_ip', (q) => q.eq('url', args.url).eq('ipHash', args.ipHash))
			.collect();

		// Dedup any stray rows from a past race so membership is exactly one or
		// zero. Their counter corrections ride along with the real change below,
		// rather than each re-reading and re-patching the same row.
		let delta = 0;
		for (let i = 1; i < rows.length; i++) {
			await ctx.db.delete('likes', rows[i]._id);
			delta--;
		}
		const existing = rows[0] ?? null;

		// Only spend a rate-limit token (and write) when the state actually changes,
		// so idempotent re-sends from the optimistic client are free no-ops.
		if (args.liked !== (existing !== null)) {
			await visitor.spend('like');
			if (args.liked) {
				await ctx.db.insert('likes', { url: args.url, ipHash: args.ipHash });
				delta++;
			} else {
				await ctx.db.delete('likes', existing._id);
				delta--;
			}
		}

		if (delta !== 0) await adjustCount(ctx, 'likeCounts', args.url, delta);

		// The count goes through `readLikeCount`, the only thing that knows
		// whether the denormalized counter is authoritative yet.
		return { count: await readLikeCount(ctx, args.url), liked: args.liked };
	}
});

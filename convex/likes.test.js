/**
 * Likes.
 *
 * `setLike` now reports the state it just wrote instead of re-reading it, and
 * moves the denormalized counter once per call rather than once per row
 * touched. Both halves are checked against the `likes` table itself, and under
 * both read regimes: before the backfill flag is set the count is derived from
 * the rows, after it the counter row is authoritative, and the two must not be
 * allowed to disagree.
 */

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import rateLimiter from '@convex-dev/rate-limiter/test';
import { api } from './_generated/api.js';
import schema from './schema.js';

const modules = import.meta.glob('./**/*.js');

const URL = '/blog/test';
const IP = 'visitor';

function setup() {
	const t = convexTest(schema, modules);
	t.registerComponent('rateLimiter', rateLimiter.schema, rateLimiter.modules);
	return t;
}

/** Mark the like-count backfill done, so reads trust the denormalized row. */
async function completeBackfill(t) {
	await t.run(async (ctx) => {
		await ctx.db.insert('migrationMeta', { key: 'likeCounts', complete: true });
	});
}

/** The denormalized counter, whether or not reads are using it yet. */
async function storedCount(t) {
	return await t.run(async (ctx) => {
		const rows = await ctx.db
			.query('likeCounts')
			.withIndex('by_url', (q) => q.eq('url', URL))
			.collect();
		return rows.reduce((sum, row) => sum + row.count, 0);
	});
}

/** Rows in the likes table — the source of truth the counter must track. */
async function rowCount(t) {
	return await t.run(async (ctx) => {
		const rows = await ctx.db
			.query('likes')
			.withIndex('by_url_ip', (q) => q.eq('url', URL))
			.collect();
		return rows.length;
	});
}

describe('setLike', () => {
	it('records a like and reports it without re-reading', async () => {
		const t = setup();

		const result = await t.mutation(api.likes.setLike, { url: URL, ipHash: IP, liked: true });

		expect(result).toEqual({ count: 1, liked: true });
		expect(await rowCount(t)).toBe(1);
		expect(await storedCount(t)).toBe(1);
	});

	it('is a no-op when the desired state already holds', async () => {
		const t = setup();
		await t.mutation(api.likes.setLike, { url: URL, ipHash: IP, liked: true });

		// The optimistic client re-sends its intent; this must not stack.
		const result = await t.mutation(api.likes.setLike, { url: URL, ipHash: IP, liked: true });

		expect(result).toEqual({ count: 1, liked: true });
		expect(await storedCount(t)).toBe(1);
	});

	it('toggles off and takes the counter with it', async () => {
		const t = setup();
		await t.mutation(api.likes.setLike, { url: URL, ipHash: IP, liked: true });

		const result = await t.mutation(api.likes.setLike, { url: URL, ipHash: IP, liked: false });

		expect(result).toEqual({ count: 0, liked: false });
		expect(await rowCount(t)).toBe(0);
		expect(await storedCount(t)).toBe(0);
	});

	it('falls back to a toggle when no desired state is sent', async () => {
		const t = setup();

		expect(await t.mutation(api.likes.setLike, { url: URL, ipHash: IP })).toEqual({
			count: 1,
			liked: true
		});
		expect(await t.mutation(api.likes.setLike, { url: URL, ipHash: IP })).toEqual({
			count: 0,
			liked: false
		});
	});

	it('counts each visitor once', async () => {
		const t = setup();
		await t.mutation(api.likes.setLike, { url: URL, ipHash: 'a', liked: true });
		const result = await t.mutation(api.likes.setLike, { url: URL, ipHash: 'b', liked: true });

		expect(result.count).toBe(2);
		expect(await storedCount(t)).toBe(2);
	});

	it('dedupes stray rows and corrects the counter in the same pass', async () => {
		const t = setup();
		await t.run(async (ctx) => {
			await ctx.db.insert('likes', { url: URL, ipHash: IP });
			await ctx.db.insert('likes', { url: URL, ipHash: IP });
			await ctx.db.insert('likeCounts', { url: URL, count: 2 });
		});

		// Already liked, so the only work is retiring the duplicate.
		const result = await t.mutation(api.likes.setLike, { url: URL, ipHash: IP, liked: true });

		expect(result).toEqual({ count: 1, liked: true });
		expect(await rowCount(t)).toBe(1);
		expect(await storedCount(t)).toBe(1);
	});

	it('serves the denormalized counter once the backfill is marked done', async () => {
		const t = setup();
		await completeBackfill(t);

		await t.mutation(api.likes.setLike, { url: URL, ipHash: 'a', liked: true });
		const result = await t.mutation(api.likes.setLike, { url: URL, ipHash: 'b', liked: true });

		// Same answer either way — which is the point of keeping them in step.
		expect(result.count).toBe(2);
		expect(await rowCount(t)).toBe(2);
		expect(await storedCount(t)).toBe(2);
	});

	it('rejects a banned IP', async () => {
		const t = setup();
		await t.run(async (ctx) => {
			await ctx.db.insert('bannedIps', { ipHash: IP, reason: 'spam' });
		});

		await expect(
			t.mutation(api.likes.setLike, { url: URL, ipHash: IP, liked: true })
		).rejects.toThrow(/Banned/);
	});
});

describe('get', () => {
	it('reports the count and whether this visitor is in it', async () => {
		const t = setup();
		await t.mutation(api.likes.setLike, { url: URL, ipHash: 'someone-else', liked: true });

		expect(await t.query(api.likes.get, { url: URL, ipHash: IP })).toEqual({
			count: 1,
			liked: false
		});

		await t.mutation(api.likes.setLike, { url: URL, ipHash: IP, liked: true });
		expect(await t.query(api.likes.get, { url: URL, ipHash: IP })).toEqual({
			count: 2,
			liked: true
		});
	});
});

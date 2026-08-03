/**
 * Hard delete across batches.
 *
 * The subtree walk resumes from the nodes the previous batch did not reach,
 * rather than restarting at the root — so the thing to prove is that nothing is
 * missed on the way, and that the URL counter (now moved once per batch instead
 * of once per comment) still lands on the right number.
 */

import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rateLimiter from '@convex-dev/rate-limiter/test';
import { api } from './_generated/api.js';
import schema from './schema.js';

const modules = import.meta.glob('./**/*.js');

// The continuation is a `runAfter(0)`, so draining it needs the timer APIs.
beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

const ADMIN = 'test-admin-secret';
const URL = '/blog/test';

function setup() {
	const t = convexTest(schema, modules);
	t.registerComponent('rateLimiter', rateLimiter.schema, rateLimiter.modules);
	process.env.ADMIN_SECRET = ADMIN;
	return t;
}

function commentFields(overrides = {}) {
	return {
		url: URL,
		username: 'someone',
		passwordHash: '$2a$10$notarealhash',
		text: 'hello',
		ipHash: 'author',
		parentId: null,
		depth: 0,
		reply: null,
		updatedAt: null,
		deletedAt: null,
		upvotes: 0,
		downvotes: 0,
		...overrides
	};
}

/** A root with `childCount` replies, and the URL counter seeded to match. */
async function seedThread(t, childCount) {
	return await t.run(async (ctx) => {
		const root = await ctx.db.insert('comments', commentFields({ text: 'root' }));
		for (let i = 0; i < childCount; i++) {
			await ctx.db.insert('comments', commentFields({ parentId: root, depth: 1, text: `r${i}` }));
		}
		await ctx.db.insert('commentUrlCounts', { url: URL, count: childCount + 1 });
		return root;
	});
}

async function activeCount(t) {
	return await t.run(async (ctx) => {
		const rows = await ctx.db
			.query('comments')
			.withIndex('by_url_deleted', (q) => q.eq('url', URL).eq('deletedAt', null))
			.collect();
		return rows.length;
	});
}

async function urlCount(t) {
	return await t.run(async (ctx) => {
		const rows = await ctx.db
			.query('commentUrlCounts')
			.withIndex('by_url', (q) => q.eq('url', URL))
			.collect();
		return rows.reduce((sum, row) => sum + row.count, 0);
	});
}

describe('hardDelete', () => {
	it('retires a whole subtree that fits in one batch', async () => {
		const t = setup();
		const root = await seedThread(t, 3);

		await t.mutation(api.comments.hardDelete, { commentId: root, adminSecret: ADMIN });
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await activeCount(t)).toBe(0);
		expect(await urlCount(t)).toBe(0);
	});

	it('finishes a subtree larger than one batch via the continuation', async () => {
		const t = setup();
		// 260 comments — past the 200 cap, so the walk has to hand off a frontier.
		const root = await seedThread(t, 259);

		await t.mutation(api.comments.hardDelete, { commentId: root, adminSecret: ADMIN });
		expect(await activeCount(t)).toBeGreaterThan(0); // first batch only

		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await activeCount(t)).toBe(0);
		expect(await urlCount(t)).toBe(0);
	});

	it('reaches grandchildren under an already-deleted parent', async () => {
		const t = setup();
		const { root } = await t.run(async (ctx) => {
			const root = await ctx.db.insert('comments', commentFields({ text: 'root' }));
			const mid = await ctx.db.insert(
				'comments',
				// Already hard-deleted: traversed but not re-counted.
				commentFields({ parentId: root, depth: 1, text: 'mid', deletedAt: 1 })
			);
			await ctx.db.insert('comments', commentFields({ parentId: mid, depth: 2, text: 'leaf' }));
			await ctx.db.insert('commentUrlCounts', { url: URL, count: 2 });
			return { root };
		});

		await t.mutation(api.comments.hardDelete, { commentId: root, adminSecret: ADMIN });
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await activeCount(t)).toBe(0);
		// Only the two live comments were counted, so the tombstone must not have
		// dragged the counter below zero.
		expect(await urlCount(t)).toBe(0);
	});

	it('removes the votes attached to every deleted comment', async () => {
		const t = setup();
		const root = await seedThread(t, 2);
		await t.run(async (ctx) => {
			const all = await ctx.db.query('comments').take(10);
			for (const doc of all) {
				await ctx.db.insert('commentVotes', {
					commentId: doc._id,
					ipHash: 'visitor',
					voteType: 'up'
				});
			}
		});

		await t.mutation(api.comments.hardDelete, { commentId: root, adminSecret: ADMIN });
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		const votes = await t.run(async (ctx) => ctx.db.query('commentVotes').take(10));
		expect(votes).toHaveLength(0);
	});

	it('is a no-op on a second call, so a double-click cannot double-count', async () => {
		const t = setup();
		const root = await seedThread(t, 2);

		await t.mutation(api.comments.hardDelete, { commentId: root, adminSecret: ADMIN });
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		await t.mutation(api.comments.hardDelete, { commentId: root, adminSecret: ADMIN });
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await urlCount(t)).toBe(0);
	});
});

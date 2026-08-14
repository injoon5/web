/**
 * `checkCanCreate` — the gate the HTTP layer calls before it spends ~100ms
 * hashing a password. Two properties matter and neither is obvious from
 * reading it: it must reject exactly what `create` would reject, and it must
 * consume nothing, or calling it would itself eat the budget it is checking.
 */

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import rateLimiter from '@convex-dev/rate-limiter/test';
import { api } from './_generated/api.js';
import schema from './schema.js';

const modules = import.meta.glob('./**/*.js');

function setup() {
	const t = convexTest(schema, modules);
	t.registerComponent('rateLimiter', rateLimiter.schema, rateLimiter.modules);
	return t;
}

const IP = 'ip-hash-1';

/** The `comment` limiter: 10 tokens per minute. */
const COMMENT_CAPACITY = 10;

function newComment(overrides = {}) {
	return {
		url: '/blog/test',
		username: 'someone',
		passwordHash: '$2a$10$notarealhash',
		text: 'hello',
		ipHash: IP,
		...overrides
	};
}

describe('checkCanCreate', () => {
	it('passes for an ordinary visitor', async () => {
		const t = setup();
		await expect(t.mutation(api.comments.checkCanCreate, { ipHash: IP })).resolves.toBeNull();
	});

	it('rejects a banned IP', async () => {
		const t = setup();
		await t.run(async (ctx) => {
			await ctx.db.insert('bannedIps', { ipHash: IP, reason: 'spam' });
		});

		await expect(t.mutation(api.comments.checkCanCreate, { ipHash: IP })).rejects.toThrow(/Banned/);
	});

	it('consumes no budget — the create mutation stays the only spender', async () => {
		const t = setup();

		// Far more gate calls than the bucket holds. If `check` consumed, the
		// creates below would start failing.
		for (let i = 0; i < COMMENT_CAPACITY * 3; i++) {
			await t.mutation(api.comments.checkCanCreate, { ipHash: IP });
		}

		for (let i = 0; i < COMMENT_CAPACITY; i++) {
			await t.mutation(api.comments.create, newComment({ text: `comment ${i}` }));
		}
	});

	it('rejects once create has drained the bucket, without a hash being needed', async () => {
		const t = setup();
		for (let i = 0; i < COMMENT_CAPACITY; i++) {
			await t.mutation(api.comments.create, newComment({ text: `comment ${i}` }));
		}

		await expect(t.mutation(api.comments.checkCanCreate, { ipHash: IP })).rejects.toThrow(
			/RateLimited/
		);
		// And the real mutation agrees, so the gate is not rejecting on its own terms.
		await expect(t.mutation(api.comments.create, newComment())).rejects.toThrow(/RateLimited/);
	});

	it('lets an admin through a ban and an exhausted bucket', async () => {
		const t = setup();
		process.env.ADMIN_SECRET = 'test-admin-secret';
		await t.run(async (ctx) => {
			await ctx.db.insert('bannedIps', { ipHash: IP, reason: 'spam' });
		});
		for (let i = 0; i < COMMENT_CAPACITY; i++) {
			await t.mutation(api.comments.create, newComment({ ipHash: 'someone-else' }));
		}

		await expect(
			t.mutation(api.comments.checkCanCreate, { ipHash: IP, adminSecret: 'test-admin-secret' })
		).resolves.toBeNull();
	});
});

/**
 * `list` binds `deletedAt` on the index rather than collecting the URL and
 * filtering. Tombstones never leave the table, so this is what stops a
 * moderated page from paying for its whole history on every read.
 */
const listOpts = { numItems: 25, cursor: null };

const listPage = (t) =>
	t.query(api.comments.list, { url: '/blog/test', ipHash: IP, paginationOpts: listOpts });

describe('list', () => {
	it('serves live comments and omits hard-deleted ones', async () => {
		const t = setup();
		await t.mutation(api.comments.create, newComment({ text: 'kept' }));
		const doomed = await t.mutation(api.comments.create, newComment({ text: 'gone' }));

		process.env.ADMIN_SECRET = 'test-admin-secret';
		await t.mutation(api.comments.hardDelete, {
			commentId: doomed.id,
			adminSecret: 'test-admin-secret'
		});

		const list = await listPage(t);
		expect(list.page.map((c) => c.text)).toEqual(['kept']);
	});

	it('still serves a soft-deleted comment, as the placeholder it became', async () => {
		const t = setup();
		const comment = await t.mutation(api.comments.create, newComment({ text: 'original' }));
		await t.run(async (ctx) => {
			await ctx.db.patch('comments', comment.id, { text: '[deleted]', username: '[deleted]' });
		});

		const list = await listPage(t);
		expect(list.page).toHaveLength(1);
		expect(list.page[0].text).toBe('[deleted]');
	});

	it('keeps a reply attached to a parent that is still alive', async () => {
		const t = setup();
		const parent = await t.mutation(api.comments.create, newComment({ text: 'parent' }));
		await t.mutation(api.comments.create, newComment({ text: 'reply', parentId: parent.id }));

		const list = await listPage(t);
		expect(list.page).toHaveLength(2);
		expect(list.page.find((c) => c.text === 'reply').parentId).toBe(parent.id);
	});

	it('pages through threads ranked by score, keeping replies with their root', async () => {
		const t = setup();
		const lowRoot = await t.mutation(api.comments.create, newComment({ text: 'low root' }));
		await t.mutation(api.comments.create, newComment({ text: 'low reply', parentId: lowRoot.id }));
		const highRoot = await t.mutation(api.comments.create, newComment({ text: 'high root' }));
		await t.mutation(
			api.comments.create,
			newComment({ text: 'high reply', parentId: highRoot.id })
		);

		// Seed what the score backfill writes: a ranked `score` per root plus the
		// completion flag, so `list` reads the ranked index instead of the fallback.
		await t.run(async (ctx) => {
			await ctx.db.patch('comments', lowRoot.id, { score: 1 });
			await ctx.db.patch('comments', highRoot.id, { score: 10 });
			await ctx.db.insert('migrationMeta', { key: 'scores', complete: true });
		});

		const first = await t.query(api.comments.list, {
			url: '/blog/test',
			ipHash: IP,
			paginationOpts: { numItems: 1, cursor: null }
		});
		// Highest-scored root first, and its reply rides along so it never orphans.
		expect(first.page.map((c) => c.text)).toEqual(['high root', 'high reply']);
		expect(first.isDone).toBe(false);

		const second = await t.query(api.comments.list, {
			url: '/blog/test',
			ipHash: IP,
			paginationOpts: { numItems: 1, cursor: first.continueCursor }
		});
		expect(second.page.map((c) => c.text)).toEqual(['low root', 'low reply']);
		expect(second.isDone).toBe(true);
	});

	it('falls back to a bounded whole-page rank before the score backfill runs', async () => {
		const t = setup();
		const low = await t.mutation(api.comments.create, newComment({ text: 'low' }));
		const high = await t.mutation(api.comments.create, newComment({ text: 'high' }));

		// Legacy rows carry vote counts but no `score`, and no completion flag.
		await t.run(async (ctx) => {
			await ctx.db.patch('comments', low.id, { upvotes: 0, downvotes: 0 });
			await ctx.db.patch('comments', high.id, { upvotes: 5, downvotes: 0 });
		});

		const list = await listPage(t);
		expect(list.page.map((c) => c.text)).toEqual(['high', 'low']);
		expect(list.isDone).toBe(true);
	});
});

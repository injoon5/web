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

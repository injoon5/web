/**
 * The credential the admin dashboard's browser holds.
 *
 * ADMIN_SECRET never leaves the server, so the live subscriptions authenticate
 * with the `admin_token` session cookie instead. Three properties matter, and
 * none of them is visible from reading a single function: an unregistered token
 * buys nothing, `ensure` is idempotent (it runs on every page load, and a write
 * would push a websocket update to every open dashboard for no change), and a
 * revoked session stops working immediately rather than at the token's expiry.
 */

import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rateLimiter from '@convex-dev/rate-limiter/test';
import { api } from './_generated/api.js';
import schema from './schema.js';

const modules = import.meta.glob('./**/*.js');

const ADMIN = 'test-admin-secret';
const TOKEN = '9999999999999.abcdef0123456789.signature';
const HOUR = 60 * 60 * 1000;

// The scheduled expiry is a `runAt`, so draining it needs the timer APIs.
beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

function setup() {
	const t = convexTest(schema, modules);
	t.registerComponent('rateLimiter', rateLimiter.schema, rateLimiter.modules);
	process.env.ADMIN_SECRET = ADMIN;
	return t;
}

function register(t, { token = TOKEN, expiresAt = Date.now() + 24 * HOUR } = {}) {
	return t.mutation(api.adminSessions.ensure, {
		adminSecret: ADMIN,
		sessionToken: token,
		expiresAt
	});
}

const sessionRows = (t) => t.run(async (ctx) => await ctx.db.query('adminSessions').collect());

describe('adminSessions.ensure', () => {
	it('requires the real secret to register a session', async () => {
		const t = setup();
		await expect(
			t.mutation(api.adminSessions.ensure, {
				adminSecret: 'wrong',
				sessionToken: TOKEN,
				expiresAt: Date.now() + HOUR
			})
		).rejects.toThrow();
		expect(await sessionRows(t)).toHaveLength(0);
	});

	it('stores only a hash of the token', async () => {
		const t = setup();
		await register(t);

		const [row] = await sessionRows(t);
		expect(row.tokenHash).not.toContain(TOKEN);
		expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('is idempotent — a repeat load neither inserts nor rewrites', async () => {
		const t = setup();
		await register(t);
		const [first] = await sessionRows(t);

		await register(t);
		const rows = await sessionRows(t);

		expect(rows).toHaveLength(1);
		// A rewrite would bump `_creationTime` (insert) or invalidate every
		// dashboard subscription reading this row (patch). Neither happened.
		expect(rows[0]._id).toBe(first._id);
		expect(rows[0]._creationTime).toBe(first._creationTime);
	});

	it('does not register an already-expired token', async () => {
		const t = setup();
		await register(t, { expiresAt: Date.now() - 1 });
		expect(await sessionRows(t)).toHaveLength(0);
	});

	it('sweeps sessions the scheduler never got to', async () => {
		const t = setup();
		await t.run(async (ctx) => {
			await ctx.db.insert('adminSessions', {
				tokenHash: 'stale',
				expiresAt: Date.now() - HOUR
			});
		});

		await register(t);

		const rows = await sessionRows(t);
		expect(rows.map((r) => r.tokenHash)).not.toContain('stale');
		expect(rows).toHaveLength(1);
	});
});

describe('session-authenticated queries', () => {
	it('are refused without a registered session', async () => {
		const t = setup();
		await expect(t.query(api.admin.listUrls, { sessionToken: TOKEN })).rejects.toThrow();
		await expect(t.query(api.bans.list, { sessionToken: TOKEN })).rejects.toThrow();
		await expect(
			t.query(api.admin.listForUrl, { url: '/blog/test', sessionToken: TOKEN })
		).rejects.toThrow();
	});

	it('are refused with no credential at all', async () => {
		const t = setup();
		await expect(t.query(api.admin.listUrls, {})).rejects.toThrow();
		await expect(t.query(api.bans.list, {})).rejects.toThrow();
	});

	it('are allowed once the session is registered', async () => {
		const t = setup();
		await register(t);

		expect(await t.query(api.admin.listUrls, { sessionToken: TOKEN })).toEqual([]);
		expect(await t.query(api.bans.list, { sessionToken: TOKEN })).toEqual([]);
		expect(await t.query(api.admin.listForUrl, { url: '/blog/test', sessionToken: TOKEN })).toEqual(
			[]
		);
	});

	it('still accept ADMIN_SECRET, which is what the server routes send', async () => {
		const t = setup();
		expect(await t.query(api.admin.listUrls, { adminSecret: ADMIN })).toEqual([]);
		expect(await t.query(api.bans.list, { adminSecret: ADMIN })).toEqual([]);
	});

	it('reject a different session token than the one registered', async () => {
		const t = setup();
		await register(t);
		await expect(t.query(api.admin.listUrls, { sessionToken: 'other' })).rejects.toThrow();
	});
});

describe('revocation', () => {
	it('takes effect immediately on sign-out, not at the token expiry', async () => {
		const t = setup();
		await register(t);
		expect(await t.query(api.admin.listUrls, { sessionToken: TOKEN })).toEqual([]);

		await t.mutation(api.adminSessions.revoke, { adminSecret: ADMIN, sessionToken: TOKEN });

		expect(await sessionRows(t)).toHaveLength(0);
		await expect(t.query(api.admin.listUrls, { sessionToken: TOKEN })).rejects.toThrow();
	});

	it('deletes the session when the scheduled expiry fires', async () => {
		const t = setup();
		await register(t, { expiresAt: Date.now() + HOUR });
		expect(await sessionRows(t)).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(HOUR + 1);
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await sessionRows(t)).toHaveLength(0);
		await expect(t.query(api.admin.listUrls, { sessionToken: TOKEN })).rejects.toThrow();
	});

	it('a sign-out before the scheduled expiry does not make it throw', async () => {
		const t = setup();
		await register(t, { expiresAt: Date.now() + HOUR });
		await t.mutation(api.adminSessions.revoke, { adminSecret: ADMIN, sessionToken: TOKEN });

		await vi.advanceTimersByTimeAsync(HOUR + 1);
		await expect(t.finishAllScheduledFunctions(vi.runAllTimers)).resolves.not.toThrow();
	});

	it('requires the real secret to revoke', async () => {
		const t = setup();
		await register(t);
		await expect(
			t.mutation(api.adminSessions.revoke, { adminSecret: 'wrong', sessionToken: TOKEN })
		).rejects.toThrow();
		expect(await sessionRows(t)).toHaveLength(1);
	});
});

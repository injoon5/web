import { v } from 'convex/values';
import { internalMutation, mutation } from './_generated/server.js';
import { internal } from './_generated/api.js';
import { assertAdmin } from './lib/auth.js';
import { findSession, hashSessionToken } from './lib/adminSession.js';

// One admin, one browser, a 24h token — the table holds a handful of rows, so
// the sweep below reads a bound rather than a page.
const SWEEP_LIMIT = 100;

/**
 * Backstop for the scheduled expiry. `Date.now()` is fine here — this is a
 * mutation, not a query. Deleting nothing writes nothing, so the common case
 * costs one bounded read and invalidates no subscription.
 */
async function sweepExpired(ctx, now) {
	const rows = await ctx.db.query('adminSessions').take(SWEEP_LIMIT);
	for (const row of rows) {
		if (row.expiresAt <= now) await ctx.db.delete('adminSessions', row._id);
	}
}

/**
 * Register the session cookie SvelteKit issued, so the dashboard's websocket
 * subscriptions can authenticate as themselves.
 *
 * Idempotent on purpose: `/admin`'s server load calls this on every visit, and
 * re-patching the row would push a websocket update to every open dashboard for
 * no change at all.
 */
export const ensure = mutation({
	args: {
		adminSecret: v.string(),
		sessionToken: v.string(),
		expiresAt: v.number()
	},
	handler: async (ctx, { adminSecret, sessionToken, expiresAt }) => {
		await assertAdmin(adminSecret);

		const now = Date.now();
		if (expiresAt <= now) return;

		await sweepExpired(ctx, now);

		const existing = await findSession(ctx, sessionToken);
		if (existing) return;

		const sessionId = await ctx.db.insert('adminSessions', {
			tokenHash: await hashSessionToken(sessionToken),
			expiresAt
		});
		await ctx.scheduler.runAt(expiresAt, internal.adminSessions.expire, { sessionId });
	}
});

/** Sign-out. Every tab holding this token loses its subscriptions at once. */
export const revoke = mutation({
	args: { adminSecret: v.string(), sessionToken: v.string() },
	handler: async (ctx, { adminSecret, sessionToken }) => {
		await assertAdmin(adminSecret);
		const existing = await findSession(ctx, sessionToken);
		if (existing) await ctx.db.delete('adminSessions', existing._id);
	}
});

export const expire = internalMutation({
	args: { sessionId: v.id('adminSessions') },
	handler: async (ctx, { sessionId }) => {
		// A sign-out may have deleted it already.
		const existing = await ctx.db.get('adminSessions', sessionId);
		if (existing) await ctx.db.delete('adminSessions', sessionId);
	}
});

/**
 * Admin credentials, for the two callers that hold different ones.
 *
 * The SvelteKit `/api/admin/*` routes hold ADMIN_SECRET and pass it straight
 * through. The dashboard's own websocket subscriptions cannot — the secret is
 * the master key, bypasses every rate limit and never expires — so they carry
 * the `admin_token` session cookie instead, which is scoped, expiring and
 * revocable. Both land here.
 */

import { ConvexError } from 'convex/values';
import { isAdmin } from './auth.js';

/**
 * SHA-256 of a session token, as lowercase hex. Only the digest is stored, so
 * a leaked table dump is not a set of working credentials.
 */
export async function hashSessionToken(token) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * The session row a token names, or null. `.first()` rather than `.unique()`:
 * a duplicate should be impossible, and is not worth turning a read into a
 * throw if it ever happens.
 */
export async function findSession(ctx, token) {
	if (!token) return null;
	const tokenHash = await hashSessionToken(token);
	return await ctx.db
		.query('adminSessions')
		.withIndex('by_token', (q) => q.eq('tokenHash', tokenHash))
		.first();
}

/**
 * Accept either credential. Reading the session row puts it in the query's read
 * set, so revoking the session re-runs every subscription that authenticated
 * with it — and each one then throws here.
 */
export async function assertAdminAccess(ctx, { adminSecret, sessionToken }) {
	if (adminSecret && (await isAdmin(adminSecret))) return;
	if (await findSession(ctx, sessionToken)) return;
	throw new ConvexError({ kind: 'Unauthorized' });
}

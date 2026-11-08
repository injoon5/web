// @ts-check
import { createHmac } from 'crypto';
import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$app/env/public';
import { ADMIN_SECRET } from '$app/env/private';

if (!PUBLIC_CONVEX_URL) {
	throw new Error('PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to provision a deployment.');
}

export const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

/**
 * Proof for Convex that a write came from this server, which is the only party
 * allowed to say whose `ipHash` it is. HMAC-SHA256 of a fixed context under
 * ADMIN_SECRET, hex: must match `deriveServerCredential` in
 * convex/lib/serverCall.js. Every visitor-side write sends it; unlike
 * ADMIN_SECRET it bypasses nothing.
 */
export const serverCredential = ADMIN_SECRET
	? createHmac('sha256', ADMIN_SECRET).update('convex-server-call').digest('hex')
	: '';

/**
 * A query a server render can do without: its result, or null if Convex fails
 * or takes more than three seconds. The page's live subscription then loads it
 * in the browser instead.
 *
 * @template T
 * @param {import('convex/server').FunctionReference<'query', 'public', any, T>} query
 * @param {Record<string, unknown>} [args]
 * @returns {Promise<T | null>}
 */
export function queryOrNull(query, args = {}) {
	/** @type {ReturnType<typeof setTimeout>} */
	let timer;
	const timeout = new Promise((resolve) => (timer = setTimeout(() => resolve(null), 3000)));
	const result = convex.query(query, args).catch((err) => {
		console.error(err);
		return null;
	});
	return /** @type {Promise<T | null>} */ (
		Promise.race([result, timeout]).finally(() => clearTimeout(timer))
	);
}

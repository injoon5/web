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

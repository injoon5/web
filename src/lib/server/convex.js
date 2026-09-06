import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { BACKEND_WRITE_SECRET } from '$env/static/private';

if (!PUBLIC_CONVEX_URL) {
	throw new Error('PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to provision a deployment.');
}

export const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

/**
 * The credential every public Convex write takes, proving the call came through
 * this server rather than straight at the deployment URL the browser already
 * holds — see `assertBackend` in convex/lib/auth.js for why that matters.
 *
 * Imported here and nowhere else, so "does this reach the browser?" is one
 * import to audit. It must not: this module is under `$lib/server`, which
 * SvelteKit refuses to pull into a client bundle, and the value belongs in no
 * `load` return, no page data and no response body.
 *
 * It is not `ADMIN_SECRET` and does not stand in for it. The routes that need
 * admin rights still send that one as well.
 */
export const backendSecret = BACKEND_WRITE_SECRET;

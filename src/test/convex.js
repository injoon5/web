// A convex-test instance for the tests under convex/. Lives outside convex/
// because every non-test file there is deployed as a function module.
import { convexTest } from 'convex-test';
import { getFunctionName } from 'convex/server';
import rateLimiter from '@convex-dev/rate-limiter/test';
import schema from '../../convex/schema.js';
import { SERVER_CALL_FUNCTIONS, deriveServerCredential } from '../../convex/lib/serverCall.js';

export const TEST_ADMIN_SECRET = 'test-admin-secret';

const modules = import.meta.glob('../../convex/**/*.js');
const GATED = new Set(SERVER_CALL_FUNCTIONS);

/**
 * A fresh deployment with `ADMIN_SECRET` set. Calls to the functions that only
 * accept the SvelteKit server (convex/lib/serverCall.js) carry the credential
 * the server would send, unless `serverCall` is false.
 */
export function setupConvex({ serverCall = true } = {}) {
	process.env.ADMIN_SECRET = TEST_ADMIN_SECRET;
	const t = convexTest(schema, modules);
	t.registerComponent('rateLimiter', rateLimiter.schema, rateLimiter.modules);
	if (!serverCall) return t;

	for (const kind of /** @type {const} */ (['mutation', 'action'])) {
		const call = t[kind].bind(t);
		t[kind] = async (fn, args = {}) => {
			if (!GATED.has(getFunctionName(fn))) return call(fn, args);
			const serverCredential = await deriveServerCredential(TEST_ADMIN_SECRET);
			return call(fn, { serverCredential, ...args });
		};
	}
	return t;
}

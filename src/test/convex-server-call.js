// Test helper for the four Convex mutations that only accept calls from the
// SvelteKit server (convex/lib/serverCall.js). Wraps a convex-test instance so
// those calls carry the credential the server would send, derived from
// whatever ADMIN_SECRET the test has in effect at the time of the call.
import { getFunctionName } from 'convex/server';
import { deriveServerCredential } from '../../convex/lib/serverCall.js';

const GATED = new Set([
	'likes:setLike',
	'comments:create',
	'comments:vote',
	'comments:checkCanCreate',
	'commentActions:editComment',
	'commentActions:softDeleteComment'
]);

export const TEST_ADMIN_SECRET = 'test-admin-secret';

/** @template {{ mutation: Function, action: Function }} T @param {T} t @returns {T} */
export function withServerCall(t) {
	const mutation = t.mutation.bind(t);
	t.mutation = async (fn, args = {}) => {
		if (!GATED.has(getFunctionName(fn))) return mutation(fn, args);
		process.env.ADMIN_SECRET ??= TEST_ADMIN_SECRET;
		const serverCredential = await deriveServerCredential(process.env.ADMIN_SECRET);
		return mutation(fn, { serverCredential, ...args });
	};
	const action = t.action.bind(t);
	t.action = async (fn, args = {}) => {
		if (!GATED.has(getFunctionName(fn))) return action(fn, args);
		process.env.ADMIN_SECRET ??= TEST_ADMIN_SECRET;
		const serverCredential = await deriveServerCredential(process.env.ADMIN_SECRET);
		return action(fn, { serverCredential, ...args });
	};
	return t;
}

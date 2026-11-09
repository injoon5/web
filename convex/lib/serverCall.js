import { hmacHex, secretsMatch } from './crypto.js';
import { fail } from './errors.js';

/**
 * Proof that a call came from the SvelteKit server.
 *
 * These public functions key bans, rate limits, like dedup or the password
 * attempt limit on the `ipHash` they are handed. The Convex URL ships in the
 * client bundle, so without this anyone could call them directly with a fresh
 * made-up hash per request and walk past all of it. Each takes
 * `visitorWriteArgs` (./visitorWrite.js), except `softDeleteComment`, which
 * takes no `adminSecret`: a visitor's delete never inspects admin auth.
 * `convex/serverCall.test.js` checks this list against the validators.
 */
export const SERVER_CALL_FUNCTIONS = [
	'likes:setLike',
	'comments:create',
	'comments:vote',
	'comments:checkCanCreate',
	'commentActions:editComment',
	'commentActions:softDeleteComment'
];

/**
 * The credential is derived from ADMIN_SECRET, which both sides already hold,
 * rather than being a second secret to keep in step. It is not ADMIN_SECRET
 * itself: that one bypasses every limit, and every ordinary visitor's write
 * carries this. `src/lib/server/convex.js` derives the same string with Node's
 * crypto, and `src/lib/server/convex.test.js` pins the two together.
 */
export const SERVER_CALL_CONTEXT = 'convex-server-call';

/** @param {string} secret */
export function deriveServerCredential(secret) {
	return hmacHex(secret, SERVER_CALL_CONTEXT);
}

/** @param {string | undefined} credential */
export async function assertServerCall(credential) {
	const secret = process.env.ADMIN_SECRET;
	if (!secret || !credential) fail('Unauthorized');
	if (!(await secretsMatch(credential, await deriveServerCredential(secret)))) {
		fail('Unauthorized');
	}
}

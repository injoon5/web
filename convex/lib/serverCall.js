import { ConvexError } from 'convex/values';
import { secretsMatch } from './secrets.js';

/**
 * Proof that a call came from the SvelteKit server.
 *
 * `likes.setLike`, `comments.create`, `comments.vote` and
 * `comments.checkCanCreate` key bans, rate limits and like dedup on the
 * `ipHash` they are handed. They are public functions — the Convex URL ships in
 * the client bundle — so without this anyone could call them directly with a
 * fresh made-up hash per request and walk past all three.
 *
 * The credential is derived from ADMIN_SECRET, which both sides already hold,
 * rather than being a second secret to keep in step. It is not ADMIN_SECRET
 * itself: that one bypasses every limit, and every ordinary visitor's write
 * carries this. Must match `serverCredential` in src/lib/server/convex.js.
 */
export const SERVER_CALL_CONTEXT = 'convex-server-call';

/** @param {string} secret */
export async function deriveServerCredential(secret) {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = new Uint8Array(
		await crypto.subtle.sign('HMAC', key, enc.encode(SERVER_CALL_CONTEXT))
	);
	return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** @param {string | undefined} credential */
export async function assertServerCall(credential) {
	const secret = process.env.ADMIN_SECRET;
	if (!secret || !credential) throw new ConvexError({ kind: 'Unauthorized' });
	if (!(await secretsMatch(credential, await deriveServerCredential(secret)))) {
		throw new ConvexError({ kind: 'Unauthorized' });
	}
}

import { ConvexError, v } from 'convex/values';
import { limiter } from '../rateLimits.js';
import { isAdmin } from './auth.js';
import { isBanned } from './bans.js';
import { fail } from './errors.js';
import { assertServerCall } from './serverCall.js';

/**
 * Arguments every write keyed on a visitor's `ipHash` takes. `ipHash` is only
 * trusted from the SvelteKit server, which proves itself with
 * `serverCredential` (see ./serverCall.js); a valid `adminSecret` lifts the
 * ban and every rate limit.
 */
export const visitorWriteArgs = {
	ipHash: v.string(),
	adminSecret: v.optional(v.string()),
	serverCredential: v.string()
};

/**
 * The one gate in front of a visitor write: the server credential, then the
 * admin bypass, then the ban. Returns the rate limiter bound to this visitor,
 * which the caller spends from only once it knows the write will happen.
 *
 * @param {any} ctx  a mutation context
 * @param {{ ipHash: string, adminSecret?: string, serverCredential: string }} args
 */
export async function beginVisitorWrite(ctx, { ipHash, adminSecret, serverCredential }) {
	await assertServerCall(serverCredential);
	const admin = await isAdmin(adminSecret);
	if (!admin && (await isBanned(ctx, ipHash))) fail('Banned');

	return {
		/** Spend one token of `name`, throwing `RateLimited` when there is none. */
		async spend(name) {
			if (!admin) await limiter.limit(ctx, name, { key: ipHash, throws: true });
		},
		/** Throw the limiter's own `RateLimited` error as `spend` would, without spending. */
		async check(name) {
			if (admin) return;
			const { ok, retryAfter } = await limiter.check(ctx, name, { key: ipHash });
			if (!ok) throw new ConvexError({ kind: 'RateLimited', name, retryAfter });
		}
	};
}

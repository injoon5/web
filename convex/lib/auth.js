import { ConvexError } from 'convex/values';
import { secretsMatch } from './secrets.js';

export async function isAdmin(secret) {
	return (
		Boolean(process.env.ADMIN_SECRET) && (await secretsMatch(secret, process.env.ADMIN_SECRET))
	);
}

export async function assertAdmin(secret) {
	if (!(await isAdmin(secret))) {
		throw new ConvexError({ kind: 'Unauthorized' });
	}
}

/**
 * The credential that says "this write came in through the SvelteKit server".
 *
 * Every public write takes `ipHash` and treats it as the caller's identity, and
 * these mutations are a *public* Convex API — anyone can call them over the wire
 * with the deployment URL the browser already has. So without this, a visitor
 * could post as any hash they liked and roll it the moment a ban or a rate limit
 * caught up with them, and skip `isValidPageUrl` on the way. Only SvelteKit
 * knows the pepper behind `hashIp`, and only SvelteKit knows this.
 *
 * It is deliberately NOT `ADMIN_SECRET`, and must never be collapsed into it:
 * this proves the request came through the front door and nothing more, where
 * `isAdmin` waives the ban check and every rate limit. The bans and limiters
 * still run on the hash the server computed.
 *
 * Unset means every public write is refused, which is a deploy-ordering mistake
 * rather than an attack — hence the log line beside the generic 401.
 */
export async function assertBackend(secret) {
	const expected = process.env.BACKEND_WRITE_SECRET;
	if (!expected) {
		console.error(
			'BACKEND_WRITE_SECRET is not set in this deployment — refusing every public write. ' +
				'Set it with `npx convex env set BACKEND_WRITE_SECRET "<value>"`.'
		);
		throw new ConvexError({ kind: 'Unauthorized' });
	}
	if (!(await secretsMatch(secret, expected))) {
		throw new ConvexError({ kind: 'Unauthorized' });
	}
}

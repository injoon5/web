// @ts-check
import { error } from '@sveltejs/kit';
import { ADMIN_SECRET } from '$app/env/private';
import { serverCredential } from '#lib/server/convex.js';
import { requestIpHash } from '#lib/server/ip.js';
import { verifyAdminSecret } from '#lib/server/admin.js';

/**
 * The arguments every visitor write sends Convex (`visitorWriteArgs` in
 * convex/lib/visitorWrite.js): whose write it is, proof that this server is the
 * one saying so, and the admin secret when the request is the admin's.
 *
 * @param {Request} request
 */
export function visitorArgs(request) {
	return {
		ipHash: requestIpHash(request),
		serverCredential,
		adminSecret: verifyAdminSecret(request) ? ADMIN_SECRET : undefined
	};
}

/**
 * The arguments an admin-only Convex call sends, or a 401 for anyone else.
 *
 * @param {Request} request
 */
export function adminArgs(request) {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');
	return { adminSecret: ADMIN_SECRET };
}

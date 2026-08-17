import { json } from '@sveltejs/kit';
import { verifyAdminSecret } from '$lib/server/admin.js';

/**
 * Reports whether the caller holds a valid admin credential (header or the
 * httpOnly `admin_token` cookie). This is what lets `/now` be prerendered: the
 * page ships as static HTML and the client asks here whether to reveal the
 * owner-only Edit affordance. Returns `{ isAdmin: false }` for every visitor.
 *
 * @type {import('./$types').RequestHandler}
 */
export const GET = ({ request }) => {
	return json({ isAdmin: verifyAdminSecret(request) });
};

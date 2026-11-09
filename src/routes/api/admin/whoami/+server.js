import { verifyAdminSecret } from '#lib/server/admin.js';

/**
 * Whether the caller holds a valid admin credential (header or the httpOnly
 * `admin_token` cookie). `/now` is an ISR page, cached and identical for
 * everyone, so it asks here in the browser whether to show the owner's Edit
 * button — and only when the `admin_hint` cookie says the answer may be yes.
 *
 * @type {import('./$types').RequestHandler}
 */
export const GET = ({ request }) => {
	return Response.json({ isAdmin: verifyAdminSecret(request) });
};

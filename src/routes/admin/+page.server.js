import { redirect, fail } from '@sveltejs/kit';
import { ADMIN_SECRET } from '$app/env/private';
import { ADMIN_TOKEN_COOKIE } from '#lib/cookies.js';
import { convex } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import {
	clearAdminCookies,
	secretsMatch,
	sessionTokenExpiry,
	setAdminCookies
} from '#lib/server/admin.js';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ cookies }) => {
	const token = cookies.get(ADMIN_TOKEN_COOKIE) ?? '';
	const expiresAt = sessionTokenExpiry(token);
	if (expiresAt === null) return { authenticated: false, sessionToken: null };

	// The dashboard subscribes to the admin queries directly over Convex's
	// websocket, so it needs a credential the browser is allowed to hold.
	// ADMIN_SECRET is not one — it is the master key, bypasses every rate limit
	// and never expires. This registers the session cookie instead (as a hash),
	// which is scoped to reads, expires with the cookie, and dies on sign-out.
	// Idempotent, so the repeat visit costs a bounded read and no write.
	await convex.mutation(api.adminSessions.ensure, {
		adminSecret: ADMIN_SECRET,
		sessionToken: token,
		expiresAt
	});

	return { authenticated: true, sessionToken: token };
};

/** @type {import('./$types').Actions} */
export const actions = {
	login: async ({ request, cookies }) => {
		const form = await request.formData();
		const password = form.get('password');

		if (!ADMIN_SECRET) return fail(500, { error: 'Admin access is not configured' });
		if (typeof password !== 'string' || !secretsMatch(password)) {
			return fail(401, { error: 'Incorrect password' });
		}

		setAdminCookies(cookies);

		// The redirect lands on `load`, which registers the new token with Convex.
		throw redirect(303, '/admin');
	},

	logout: async ({ cookies }) => {
		const token = clearAdminCookies(cookies);

		// Drop the session row too, or a tab left open elsewhere keeps its live
		// subscriptions until the token's own expiry. Deleting the row is what
		// re-runs those queries, and they then fail their auth check.
		if (sessionTokenExpiry(token) !== null) {
			await convex.mutation(api.adminSessions.revoke, {
				adminSecret: ADMIN_SECRET,
				sessionToken: token
			});
		}

		throw redirect(303, '/admin');
	}
};

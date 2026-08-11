import { redirect, fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { ADMIN_SECRET } from '$env/static/private';
import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import {
	createAdminSessionToken,
	secretsMatch,
	sessionTokenExpiry,
	verifyAdminSessionToken,
	SESSION_MAX_AGE_MS
} from '$lib/server/admin.js';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ cookies }) => {
	const token = cookies.get('admin_token') ?? '';
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

		cookies.set('admin_token', createAdminSessionToken(), {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: !dev,
			// Keep the cookie lifetime in lockstep with the token's own expiry.
			maxAge: SESSION_MAX_AGE_MS / 1000
		});

		// The redirect lands on `load`, which registers the new token with Convex.
		throw redirect(303, '/admin');
	},

	logout: async ({ cookies }) => {
		const token = cookies.get('admin_token') ?? '';
		cookies.delete('admin_token', { path: '/' });

		// Drop the session row too, or a tab left open elsewhere keeps its live
		// subscriptions until the token's own expiry. Deleting the row is what
		// re-runs those queries, and they then fail their auth check.
		if (ADMIN_SECRET && verifyAdminSessionToken(token)) {
			await convex.mutation(api.adminSessions.revoke, {
				adminSecret: ADMIN_SECRET,
				sessionToken: token
			});
		}

		throw redirect(303, '/admin');
	}
};

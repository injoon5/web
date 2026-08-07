import { redirect, fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { ADMIN_SECRET } from '$env/static/private';
import {
	createAdminSessionToken,
	secretsMatch,
	verifyAdminSessionToken,
	SESSION_MAX_AGE_MS
} from '$lib/server/admin.js';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ cookies }) => {
	return { authenticated: verifyAdminSessionToken(cookies.get('admin_token') ?? '') };
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

		throw redirect(303, '/admin');
	},

	logout: async ({ cookies }) => {
		cookies.delete('admin_token', { path: '/' });
		throw redirect(303, '/admin');
	}
};

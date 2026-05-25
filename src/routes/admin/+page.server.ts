import { redirect, fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Actions, PageServerLoad } from './$types';
import { ADMIN_SECRET } from '$env/static/private';
import { createAdminSessionToken, secretsMatch, verifyAdminSessionToken } from '$lib/server/admin';

export const load: PageServerLoad = async ({ cookies }) => {
	return { authenticated: verifyAdminSessionToken(cookies.get('admin_token') ?? '') };
};

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
			maxAge: 60 * 60 * 24
		});

		throw redirect(303, '/admin');
	},

	logout: async ({ cookies }) => {
		cookies.delete('admin_token', { path: '/' });
		throw redirect(303, '/admin');
	}
} satisfies Actions;

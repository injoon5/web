import { redirect, fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Actions, PageServerLoad } from './$types';
import { ADMIN_SECRET } from '$env/static/private';
import { secretsMatch } from '$lib/server/admin';

function tokenValid(token: string | undefined): boolean {
	return !!token && secretsMatch(token);
}

export const load: PageServerLoad = async ({ cookies }) => {
	return { authenticated: tokenValid(cookies.get('admin_token')) };
};

export const actions = {
	login: async ({ request, cookies }) => {
		const form = await request.formData();
		const password = form.get('password');

		if (!ADMIN_SECRET) return fail(500, { error: 'Admin access is not configured' });
		if (typeof password !== 'string' || !tokenValid(password)) {
			return fail(401, { error: 'Incorrect password' });
		}

		cookies.set('admin_token', ADMIN_SECRET, {
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

import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ADMIN_SECRET } from '$env/static/private';
import { timingSafeEqual } from 'crypto';

function tokenValid(token: string | undefined): boolean {
	if (!token || !ADMIN_SECRET) return false;
	const a = Buffer.from(token);
	const b = Buffer.from(ADMIN_SECRET);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
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
			maxAge: 60 * 60 * 24
		});

		throw redirect(303, '/admin');
	},

	logout: async ({ cookies }) => {
		cookies.delete('admin_token', { path: '/' });
		throw redirect(303, '/admin');
	}
} satisfies Actions;

import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('admin_token');
	const authenticated = token === env.ADMIN_SECRET;
	return { authenticated, adminSecret: authenticated ? token : null };
};

export const actions = {
	login: async ({ request, cookies }) => {
		const form = await request.formData();
		const password = form.get('password');

		if (!env.ADMIN_SECRET) return fail(500, { error: 'Admin access is not configured' });
		if (password !== env.ADMIN_SECRET) return fail(401, { error: 'Incorrect password' });

		cookies.set('admin_token', env.ADMIN_SECRET, {
			path: '/admin',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 // 24 hours
		});

		throw redirect(303, '/admin');
	},

	logout: async ({ cookies }) => {
		cookies.delete('admin_token', { path: '/admin' });
		throw redirect(303, '/admin');
	}
} satisfies Actions;

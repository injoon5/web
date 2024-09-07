import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const token = form.get('token');

		if (!token || typeof token !== 'string') {
			throw redirect(303, '/auth');
		}

		// Set the cookie with a specified path
		cookies.set('pb_auth', JSON.stringify({ token: token }), { path: '/' });

		// Get the 'goto' query parameter if it exists, default to home page
		const goto = url.searchParams.get('goto') || '/';

		// Redirect to the specified 'goto' page or the home page
		throw redirect(303, goto);
	}
} satisfies Actions;

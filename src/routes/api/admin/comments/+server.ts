import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex, api } from '$lib/server/convex.js';
import { verifyAdminSecret } from '$lib/server/admin';

export const GET: RequestHandler = async ({ request, url }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const urlFilter = url.searchParams.get('url');

	if (!urlFilter) {
		const urls = await convex.query(api.comments.getAdminUrls, {});
		return json({ urls });
	}

	const comments = await convex.query(api.comments.getAdminComments, { url: urlFilter });
	return json({ comments });
};

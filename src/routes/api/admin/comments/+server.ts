import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { convexErrorToResponse } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ request, url }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const urlFilter = url.searchParams.get('url');

	try {
		if (!urlFilter) {
			const urls = await convex.query(api.admin.listUrls, { adminSecret: ADMIN_SECRET });
			return json({ urls });
		}
		const comments = await convex.query(api.admin.listForUrl, {
			url: urlFilter,
			adminSecret: ADMIN_SECRET
		});
		return json({ comments });
	} catch (err) {
		const mapped = convexErrorToResponse(err);
		if (mapped instanceof Response) return mapped;
		throw mapped;
	}
};

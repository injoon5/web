import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { runConvex } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ request, url }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const urlFilter = url.searchParams.get('url');

	if (!urlFilter) {
		return runConvex(
			() => convex.query(api.admin.listUrls, { adminSecret: ADMIN_SECRET }),
			(urls) => json({ urls })
		);
	}
	return runConvex(
		() => convex.query(api.admin.listForUrl, { url: urlFilter, adminSecret: ADMIN_SECRET }),
		(comments) => json({ comments })
	);
};

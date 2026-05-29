import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { requireAdmin } from '$lib/server/admin';
import { runConvex } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ request, url }) => {
	requireAdmin(request);

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

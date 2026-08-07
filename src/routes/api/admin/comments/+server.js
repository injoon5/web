import { json } from '@sveltejs/kit';
import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { requireAdmin } from '$lib/server/admin.js';
import { runConvex } from '$lib/server/api.js';
import { ADMIN_SECRET } from '$env/static/private';

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ request, url }) => {
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

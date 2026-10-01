import { convex } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import { requireAdmin } from '#lib/server/admin.js';
import { runConvex } from '#lib/server/api.js';
import { ADMIN_SECRET } from '$app/env/private';

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ request, url }) => {
	requireAdmin(request);

	const urlFilter = url.searchParams.get('url');

	if (!urlFilter) {
		return runConvex(
			() => convex.query(api.admin.listUrls, { adminSecret: ADMIN_SECRET }),
			(urls) => Response.json({ urls })
		);
	}
	return runConvex(
		() => convex.query(api.admin.listForUrl, { url: urlFilter, adminSecret: ADMIN_SECRET }),
		(comments) => Response.json({ comments })
	);
};

import { convex } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import { adminArgs } from '#lib/server/callers.js';
import { runConvex } from '#lib/server/api.js';

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ request, url }) => {
	const admin = adminArgs(request);
	const pageUrl = url.searchParams.get('url');

	if (!pageUrl) {
		return runConvex(
			() => convex.query(api.admin.listUrls, admin),
			(urls) => Response.json({ urls })
		);
	}
	return runConvex(
		() => convex.query(api.admin.listForUrl, { url: pageUrl, ...admin }),
		(comments) => Response.json({ comments })
	);
};

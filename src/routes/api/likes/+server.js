import { error } from '@sveltejs/kit';
import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { requestIpHash } from '$lib/server/ip.js';
import { likeSchema } from '$lib/server/validation.js';
import { verifyAdminSecret } from '$lib/server/admin.js';
import { isValidPageUrl } from '$lib/server/valid-urls.js';
import { runConvex, parseBody } from '$lib/server/api.js';
import { ADMIN_SECRET } from '$env/static/private';

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');
	const ipHash = requestIpHash(request);
	return runConvex(() => convex.query(api.likes.get, { url: pageUrl, ipHash }));
};

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request }) => {
	const ipHash = requestIpHash(request);
	const admin = verifyAdminSecret(request);
	const { url: pageUrl, liked } = await parseBody(request, likeSchema);

	if (!isValidPageUrl(pageUrl)) throw error(404, 'Page not found');

	return runConvex(() =>
		convex.mutation(api.likes.setLike, {
			url: pageUrl,
			ipHash,
			liked,
			adminSecret: admin ? ADMIN_SECRET : undefined
		})
	);
};

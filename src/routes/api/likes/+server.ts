import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { requestIpHash } from '$lib/server/ip';
import { likeSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';
import { isValidPageUrl } from '$lib/server/valid-urls';
import { runConvex, parseBody } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');
	const ipHash = requestIpHash(request);
	return runConvex(() => convex.query(api.likes.get, { url: pageUrl, ipHash }));
};

export const POST: RequestHandler = async ({ request }) => {
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

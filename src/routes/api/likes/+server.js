import { error } from '@sveltejs/kit';
import { convex } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import { requestIpHash } from '#lib/server/ip.js';
import { visitorArgs } from '#lib/server/callers.js';
import { likeSchema } from '#lib/server/validation.js';
import { isValidPageUrl } from '#lib/server/valid-urls.js';
import { runConvex, parseBody } from '#lib/server/api.js';

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');
	const ipHash = requestIpHash(request);
	return runConvex(() => convex.query(api.likes.get, { url: pageUrl, ipHash }));
};

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request }) => {
	const visitor = visitorArgs(request);
	const { url: pageUrl, liked } = await parseBody(request, likeSchema);
	if (!isValidPageUrl(pageUrl)) throw error(404, 'Page not found');

	// `ipHash` rides back so the page's subscription reads under the identity
	// this write was made with (`#lib/visitor.svelte.js` caches it per session).
	return runConvex(
		() => convex.mutation(api.likes.setLike, { url: pageUrl, liked, ...visitor }),
		(data) => Response.json({ ...data, ipHash: visitor.ipHash })
	);
};

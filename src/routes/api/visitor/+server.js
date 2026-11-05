import { requestIpHash } from '#lib/server/ip.js';

/**
 * The hash the Convex likes and votes queries are keyed on, for whoever is
 * asking. Never cached: it is per visitor. The article pages are prerendered,
 * so the browser asks for it once per session (`#lib/visitor.svelte.js`).
 *
 * @type {import('./$types').RequestHandler}
 */
export function GET({ request }) {
	return Response.json(
		{ ipHash: requestIpHash(request) },
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
}

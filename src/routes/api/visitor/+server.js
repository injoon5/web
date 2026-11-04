import { requestIpHash } from '#lib/server/ip.js';

/**
 * Who is asking: the hash the Convex likes/votes queries are keyed on, and the
 * language cookie. Never cached — both are per visitor.
 *
 * The article pages used to get these from a server load, which made every
 * client-side navigation to a post wait on a serverless round trip (a cold
 * start is over a second) before its content chunks could even be requested.
 * Now the article's universal load reads them through here only while
 * server-rendering, and the browser asks once per session, off the critical
 * path (`#lib/visitor.svelte.js`).
 *
 * @type {import('./$types').RequestHandler}
 */
export function GET({ request, cookies }) {
	return Response.json(
		{ ipHash: requestIpHash(request), lang: cookies.get('preferred-lang') ?? null },
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
}

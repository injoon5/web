import { building } from '$app/environment';
import { requestIpHash } from './ip';

/**
 * Shared server load for the bilingual content pages (blog/[slug],
 * projects/[slug]) — the only routes that render comments and likes.
 *
 * `ipHash` must be computed here, per request, on an SSR route: a root layout
 * load would bake the build machine's hash into the prerendered pages and
 * never re-run on client-side navigation, leaving every visitor subscribed to
 * Convex with the same stale hash (broken myVote/liked state).
 *
 * @param {{ cookies: import('@sveltejs/kit').Cookies, url: URL, request: Request }} event
 */
export function load({ cookies, url, request }) {
	// searchParams and cookies are unavailable while the prerender crawler
	// visits SSR-only routes linked from prerendered pages.
	if (building) return { prefLang: null, ipHash: '' };

	const fromQuery = url.searchParams.get('lang');
	const fromCookie = cookies.get('preferred-lang');
	return {
		prefLang: fromQuery || fromCookie || null,
		ipHash: requestIpHash(request)
	};
}

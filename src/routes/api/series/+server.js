import { CONTENT_CACHE_CONTROL } from '#lib/server/content.js';
import { blogEnMeta, blogKoMeta } from '#lib/server/content-modules.js';
import { allPostSeries } from '#lib/server/series.js';

/**
 * Every post's series list, keyed by slug. The article page's universal load
 * reads it here instead of from a server load, which put a serverless round
 * trip on every client-side navigation to a post.
 *
 * Not prerendered on purpose: the server render fetches this too, and SvelteKit
 * answers a fetch of a *prerendered* path with a real HTTP request back out to
 * the site, where a live route is answered in-process. The CDN caches it for
 * the browser.
 */
export function GET() {
	return Response.json(allPostSeries(blogEnMeta, blogKoMeta), {
		headers: { 'Cache-Control': CONTENT_CACHE_CONTROL }
	});
}

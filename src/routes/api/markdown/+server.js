export const prerender = false;

import { markdownForPath } from '$lib/server/markdown-pages.js';
import { markdownResponse } from '$lib/server/markdown-negotiation.js';

/**
 * Markdown for a page pathname. Used by the Vercel rewrite that intercepts
 * `Accept: text/markdown` on prerendered routes (those never hit hooks.server).
 * SSR routes go through the hook directly and never need this URL.
 *
 * @type {import('./$types').RequestHandler}
 */
export function GET({ url, cookies }) {
	const path = url.searchParams.get('path') || '/';
	if (!path.startsWith('/') || path.startsWith('//') || path.includes('..')) {
		return markdownResponse('# Not found\n', { status: 404 });
	}

	const lang = url.searchParams.get('lang') || cookies.get('preferred-lang');
	const result = markdownForPath(path, { lang });
	if (!result) return markdownResponse('# Not found\n', { status: 404 });
	return markdownResponse(result.body, { status: result.status });
}

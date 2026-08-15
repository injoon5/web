import { building } from '$app/environment';
import {
	isMarkdownNegotiable,
	markdownResponse,
	prefersMarkdown
} from '$lib/server/markdown-negotiation.js';
import { markdownForPath } from '$lib/server/markdown-pages.js';

// Resolve the %lang% placeholder in app.html. Only blog/project detail pages are
// bilingual (Korean default); the rest of the site is English chrome. The client
// reconciles this with the actually-shown language after hydration.
/** @type {import('@sveltejs/kit').Handle} */
export const handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Prerender must emit HTML. `building` is also the crawler, whose Accept we
	// must not treat as an agent. Production prerendered pages never reach this
	// hook — Vercel rewrites those markdown requests to /api/markdown instead.
	if (
		!building &&
		!event.isDataRequest &&
		isMarkdownNegotiable(pathname) &&
		prefersMarkdown(event.request.headers.get('accept'))
	) {
		const lang = event.url.searchParams.get('lang') || event.cookies.get('preferred-lang');
		const result = markdownForPath(pathname, { lang });
		if (result) return markdownResponse(result.body, { status: result.status });
	}

	const isContent = pathname.startsWith('/blog/') || pathname.startsWith('/projects/');

	let lang = 'en';
	if (isContent) {
		// searchParams (and cookies) are unavailable while the prerender crawler visits
		// SSR-only routes linked from prerendered pages — default to Korean.
		const pref = building
			? null
			: event.url.searchParams.get('lang') || event.cookies.get('preferred-lang');
		lang = pref === 'en' ? 'en' : 'ko';
	}

	return await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', lang)
	});
};

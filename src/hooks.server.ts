import { building } from '$app/environment';
import { type Handle } from '@sveltejs/kit';

// Resolve the %lang% placeholder in app.html. Only the bilingual detail pages —
// blog posts, projects and books — have a Korean default; the rest of the site
// is English chrome. The client reconciles this with the actually-shown language
// after hydration, but crawlers and screen readers only ever see this one, so a
// route missing from this list serves Korean prose declared as English.
export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const isContent =
		pathname.startsWith('/blog/') ||
		pathname.startsWith('/projects/') ||
		pathname.startsWith('/books/');

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

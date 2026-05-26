import { type Handle } from '@sveltejs/kit';

// Resolve the %lang% placeholder in app.html. Only blog/project detail pages are
// bilingual (Korean default); the rest of the site is English chrome. The client
// reconciles this with the actually-shown language after hydration.
export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const isContent = pathname.startsWith('/blog/') || pathname.startsWith('/projects/');

	let lang = 'en';
	if (isContent) {
		const pref = event.url.searchParams.get('lang') || event.cookies.get('preferred-lang');
		lang = pref === 'en' ? 'en' : 'ko';
	}

	return await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', lang)
	});
};

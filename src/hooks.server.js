import { pageLang } from '#lib/server/page-lang.js';

// Resolve the %lang% placeholder in app.html from the URL. Articles carry their
// language in the path, so this is right for prerendered pages as well.
/** @type {import('@sveltejs/kit/hooks').Handle} */
export const handle = async ({ event, resolve }) => {
	const lang = pageLang(event.url.pathname);
	return await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', lang)
	});
};

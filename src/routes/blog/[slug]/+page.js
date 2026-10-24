// Server-rendered (not prerendered) so the cookie/?lang= preferred language
// is applied on the server — the first byte is the right language, no flash.
export const prerender = false;

import { error } from '@sveltejs/kit';
import { resolveBilingualEntry, bilingualPageData } from '#lib/content/bilingual.js';

const enModules = import.meta.glob('/src/content/blog/en/*.md');
const koModules = import.meta.glob('/src/content/blog/ko/*.md');

export async function load({ params, data }) {
	const { en: enPost, ko: koPost } = await resolveBilingualEntry(
		enModules,
		koModules,
		`/src/content/blog/en/${params.slug}.md`,
		`/src/content/blog/ko/${params.slug}.md`
	);

	if (!enPost && !koPost) {
		throw error(404, `Could not find ${params.slug}`);
	}

	// The series lists come from the server load: see `postSeries`.
	return {
		...bilingualPageData(enPost, koPost, data),
		enSeries: data.enSeries,
		koSeries: data.koSeries
	};
}

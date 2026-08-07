// Server-rendered (not prerendered) so the cookie/?lang= preferred language
// is applied on the server — the first byte is the right language, no flash.
export const prerender = false;

import { error } from '@sveltejs/kit';
import { resolveBilingualEntry, bilingualPageData } from '$lib/content/bilingual.js';

const enModules = import.meta.glob('../projects/en/*.md');
const koModules = import.meta.glob('../projects/ko/*.md');

export async function load({ params, data }) {
	const { en, ko } = await resolveBilingualEntry(
		enModules,
		koModules,
		`../projects/en/${params.slug}.md`,
		`../projects/ko/${params.slug}.md`
	);

	if (!en && !ko) {
		throw error(404, `Could not find ${params.slug}`);
	}

	return bilingualPageData(en, ko, data);
}

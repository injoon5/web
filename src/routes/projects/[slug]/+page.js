// Server-rendered (not prerendered) so the cookie/?lang= preferred language
// is applied on the server — the first byte is the right language, no flash.
export const prerender = false;

// No server load, deliberately — see blog/[slug]/+page.js.

import { error } from '@sveltejs/kit';
import { resolveBilingualEntry, bilingualPageData } from '#lib/content/bilingual.js';
import { projectModules } from '#lib/content/article-modules.js';
import { preferredLang } from '#lib/visitor.svelte.js';

export async function load({ params, url, fetch }) {
	const [{ en, ko }, prefLang] = await Promise.all([
		resolveBilingualEntry(
			projectModules.en,
			projectModules.ko,
			`/src/content/projects/en/${params.slug}.md`,
			`/src/content/projects/ko/${params.slug}.md`
		),
		preferredLang(url, fetch)
	]);

	if (!en && !ko) {
		throw error(404, `Could not find ${params.slug}`);
	}

	return bilingualPageData(en, ko, prefLang);
}

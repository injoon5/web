// Prerendered so pages are served from CDN edge.
// Language preference is restored client-side via localStorage/cookie in onMount.
export const prerender = true;

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

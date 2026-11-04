// Server-rendered (not prerendered) so the cookie/?lang= preferred language
// is applied on the server — the first byte is the right language, no flash.
export const prerender = false;

// No server load, deliberately: one would put a serverless round trip in front
// of every client-side navigation to a post, and the post's own chunks could
// not even be requested until it came back. See `#lib/visitor.svelte.js`.

import { error } from '@sveltejs/kit';
import { browser } from '$app/env';
import { resolveBilingualEntry, bilingualPageData } from '#lib/content/bilingual.js';
import { seriesMap } from '#lib/content/series.js';
import { preferredLang } from '#lib/visitor.svelte.js';

const enModules = import.meta.glob('/src/content/blog/en/*.md');
const koModules = import.meta.glob('/src/content/blog/ko/*.md');

export async function load({ params, url, fetch }) {
	// In the browser the series list is started alongside the post (it is one
	// request per session) and only waited on for a post that is in a series.
	const seriesEarly = browser ? seriesMap(fetch) : null;

	const [{ en: enPost, ko: koPost }, prefLang] = await Promise.all([
		resolveBilingualEntry(
			enModules,
			koModules,
			`/src/content/blog/en/${params.slug}.md`,
			`/src/content/blog/ko/${params.slug}.md`
		),
		preferredLang(url, fetch)
	]);

	if (!enPost && !koPost) {
		throw error(404, `Could not find ${params.slug}`);
	}

	const inSeries = !!(enPost?.metadata?.series || koPost?.metadata?.series);
	const series = inSeries ? (await (seriesEarly ?? seriesMap(fetch)))[params.slug] : undefined;

	return {
		...bilingualPageData(enPost, koPost, prefLang),
		enSeries: series?.enSeries ?? [],
		koSeries: series?.koSeries ?? []
	};
}

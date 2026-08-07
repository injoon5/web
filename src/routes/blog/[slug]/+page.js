// Server-rendered (not prerendered) so the cookie/?lang= preferred language
// is applied on the server — the first byte is the right language, no flash.
export const prerender = false;

import { error } from '@sveltejs/kit';
import { resolveBilingualEntry, bilingualPageData, slugFromPath } from '$lib/content/bilingual.js';

const enModules = import.meta.glob('/src/content/blog/en/*.md');
const koModules = import.meta.glob('/src/content/blog/ko/*.md');

// Metadata only, eagerly, for resolving the series list. Building that list used
// to dynamically import every post in both languages just to read
// `metadata.series` — on a client-side navigation that fetched the chunk for
// every article on the site. `import: 'metadata'` leaves the components behind,
// so what ships is a handful of small records.
const enMeta = import.meta.glob('/src/content/blog/en/*.md', { eager: true, import: 'metadata' });
const koMeta = import.meta.glob('/src/content/blog/ko/*.md', { eager: true, import: 'metadata' });

/** @typedef {{ published?: boolean, series?: string, date?: string, slug?: string }} Metadata */

/**
 * Published metadata by slug, from one of the eager metadata globs.
 * @param {Record<string, unknown>} metaByPath
 */
function publishedBySlug(metaByPath) {
	/** @type {Map<string, Metadata>} */
	const bySlug = new Map();
	for (const path in metaByPath) {
		const meta = /** @type {Metadata | undefined} */ (metaByPath[path]);
		if (!meta?.published) continue;
		const slug = slugFromPath(path);
		bySlug.set(slug, { ...meta, slug });
	}
	return bySlug;
}

const enBySlug = publishedBySlug(enMeta);
const koBySlug = publishedBySlug(koMeta);

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

	const seriesNames = new Set([enPost?.metadata?.series, koPost?.metadata?.series].filter(Boolean));

	const enSeries = [];
	const koSeries = [];

	if (seriesNames.size > 0) {
		// Straight off the eager metadata globs — no module loading, so this is
		// synchronous and costs nothing beyond the records already in the bundle.
		const matched = [];
		for (const slug of new Set([...enBySlug.keys(), ...koBySlug.keys()])) {
			const eMeta = enBySlug.get(slug) ?? null;
			const kMeta = koBySlug.get(slug) ?? null;
			const series = eMeta?.series ?? kMeta?.series;
			if (series && seriesNames.has(series)) matched.push({ eMeta, kMeta });
		}

		/** @param {{ date?: string } | null} m */
		const dateOf = (m) => (m?.date ? new Date(m.date).getTime() : 0);
		matched.sort((a, b) => dateOf(b.eMeta ?? b.kMeta) - dateOf(a.eMeta ?? a.kMeta));

		for (const { eMeta, kMeta } of matched) {
			enSeries.push(eMeta ?? kMeta);
			koSeries.push(kMeta ?? eMeta);
		}
	}

	return {
		...bilingualPageData(enPost, koPost, data),
		enSeries,
		koSeries
	};
}

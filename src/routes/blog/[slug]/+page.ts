// Prerendered so pages are served from CDN edge.
// Language preference is restored client-side via localStorage/cookie in onMount;
// the mounted guard suppresses animations during that initial switch.
export const prerender = true;

import { error } from '@sveltejs/kit';
import { resolveBilingualEntry, bilingualPageData, slugFromPath } from '$lib/content/bilingual.js';

const enModules = import.meta.glob('../posts/en/*.md');
const koModules = import.meta.glob('../posts/ko/*.md');

// Metadata only, eagerly, for resolving the series list. Building that list used
// to dynamically import every post in both languages just to read
// `metadata.series` — on a client-side navigation that fetched the chunk for
// every article on the site. `import: 'metadata'` leaves the components behind,
// so what ships is a handful of small records.
const enMeta = import.meta.glob('../posts/en/*.md', { eager: true, import: 'metadata' });
const koMeta = import.meta.glob('../posts/ko/*.md', { eager: true, import: 'metadata' });

type Metadata = { published?: boolean; series?: string; date?: string; slug?: string };

/** Published metadata by slug, from one of the eager metadata globs. */
function publishedBySlug(metaByPath: Record<string, unknown>) {
	const bySlug = new Map<string, Metadata>();
	for (const path in metaByPath) {
		const meta = metaByPath[path] as Metadata | undefined;
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
		`../posts/en/${params.slug}.md`,
		`../posts/ko/${params.slug}.md`
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

		const dateOf = (m: { date?: string } | null) => (m?.date ? new Date(m.date).getTime() : 0);
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

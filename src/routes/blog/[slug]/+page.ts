// Server-rendered (not prerendered) so the cookie/?lang= preferred language
// is applied on the server — the first byte is the right language, no flash.
export const prerender = false;

import { error } from '@sveltejs/kit';
import { resolveBilingualEntry, bilingualPageData, slugFromPath } from '$lib/content/bilingual.js';

const enModules = import.meta.glob('../posts/en/*.md');
const koModules = import.meta.glob('../posts/ko/*.md');

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
		// Walk both globs once, load only modules that might belong to the series
		// in parallel.
		const candidateSlugs = new Set();
		for (const path in enModules) candidateSlugs.add(slugFromPath(path));
		for (const path in koModules) candidateSlugs.add(slugFromPath(path));

		const entries = await Promise.all(
			[...candidateSlugs].map(async (slug) => {
				const { en, ko } = await resolveBilingualEntry(
					enModules,
					koModules,
					`../posts/en/${slug}.md`,
					`../posts/ko/${slug}.md`
				);
				const eMeta = en ? { ...en.metadata, slug } : null;
				const kMeta = ko ? { ...ko.metadata, slug } : null;
				return { slug, eMeta, kMeta };
			})
		);

		const matched = entries.filter(({ eMeta, kMeta }) => {
			const series = eMeta?.series ?? kMeta?.series;
			return series && seriesNames.has(series);
		});

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

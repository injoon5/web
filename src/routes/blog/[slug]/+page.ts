// Server-rendered (not prerendered) so the cookie/?lang= preferred language
// is applied on the server — the first byte is the right language, no flash.
export const prerender = false;

import { error } from "@sveltejs/kit";

const enModules = import.meta.glob("../posts/en/*.md");
const koModules = import.meta.glob("../posts/ko/*.md");

const slugFromPath = (p) => p.split("/").at(-1)?.replace(".md", "") ?? "";

export async function load({ params, data }) {
	const enKey = `../posts/en/${params.slug}.md`;
	const koKey = `../posts/ko/${params.slug}.md`;

	const [enMod, koMod] = await Promise.all([
		enModules[enKey] ? enModules[enKey]() : Promise.resolve(null),
		koModules[koKey] ? koModules[koKey]() : Promise.resolve(null)
	]);

	const enPost = enMod?.metadata?.published ? enMod : null;
	const koPost = koMod?.metadata?.published ? koMod : null;

	const primaryPost = enPost || koPost;
	if (!primaryPost) {
		throw error(404, `Could not find ${params.slug}`);
	}

	const seriesNames = new Set(
		[enPost?.metadata?.series, koPost?.metadata?.series].filter(Boolean)
	);

	let enSeries = [];
	let koSeries = [];

	if (seriesNames.size > 0) {
		// Walk both globs once, load only modules that might belong to the series
		// in parallel.
		const candidateSlugs = new Set();
		for (const path in enModules) candidateSlugs.add(slugFromPath(path));
		for (const path in koModules) candidateSlugs.add(slugFromPath(path));

		const entries = await Promise.all(
			[...candidateSlugs].map(async (slug) => {
				const eKey = `../posts/en/${slug}.md`;
				const kKey = `../posts/ko/${slug}.md`;
				const [eMod, kMod] = await Promise.all([
					enModules[eKey] ? enModules[eKey]() : Promise.resolve(null),
					koModules[kKey] ? koModules[kKey]() : Promise.resolve(null)
				]);
				const eMeta = eMod?.metadata?.published ? { ...eMod.metadata, slug } : null;
				const kMeta = kMod?.metadata?.published ? { ...kMod.metadata, slug } : null;
				return { slug, eMeta, kMeta };
			})
		);

		const matched = entries.filter(({ eMeta, kMeta }) => {
			const series = eMeta?.series ?? kMeta?.series;
			return series && seriesNames.has(series);
		});

		const dateOf = (m) => (m ? new Date(m.date).getTime() : 0);
		matched.sort(
			(a, b) =>
				dateOf(b.eMeta ?? b.kMeta) - dateOf(a.eMeta ?? a.kMeta)
		);

		for (const { eMeta, kMeta } of matched) {
			enSeries.push(eMeta ?? kMeta);
			koSeries.push(kMeta ?? eMeta);
		}
	}

	const availableLangs = [
		...(koPost ? ["ko"] : []),
		...(enPost ? ["en"] : []),
	];

	return {
		enContent: enPost?.default ?? null,
		koContent: koPost?.default ?? null,
		enMeta: enPost?.metadata ?? null,
		koMeta: koPost?.metadata ?? null,
		meta: primaryPost.metadata,
		enSeries,
		koSeries,
		availableLangs,
		enReadingTime: enPost?.metadata?.readingTime ?? null,
		koReadingTime: koPost?.metadata?.readingTime ?? null,
		prefLang: data?.prefLang ?? null,
	};
}

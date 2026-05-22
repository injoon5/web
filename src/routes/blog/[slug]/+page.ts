export const prerender = true;

import { error } from "@sveltejs/kit";

const enModules = import.meta.glob("../posts/en/*.md");
const koModules = import.meta.glob("../posts/ko/*.md");

export async function load({ params, fetch }) {
	const enKey = `../posts/en/${params.slug}.md`;
	const koKey = `../posts/ko/${params.slug}.md`;

	let enPost = null;
	let koPost = null;

	if (enModules[enKey]) {
		const mod = await enModules[enKey]();
		if (mod.metadata?.published) enPost = mod;
	}
	if (koModules[koKey]) {
		const mod = await koModules[koKey]();
		if (mod.metadata?.published) koPost = mod;
	}

	const primaryPost = enPost || koPost;
	if (!primaryPost) {
		throw error(404, `Could not find ${params.slug}`);
	}

	const response = await fetch("/api/posts");
	const posts = await response.json();

	const seriesNames = new Set(
		[enPost?.metadata?.series, koPost?.metadata?.series].filter(Boolean)
	);
	const seriesSlugs = posts
		.filter((p) => p.series && seriesNames.has(p.series))
		.map((p) => p.slug);

	const enSeries = [];
	const koSeries = [];

	for (const slug of seriesSlugs) {
		const eKey = `../posts/en/${slug}.md`;
		const kKey = `../posts/ko/${slug}.md`;
		let eMeta = null;
		let kMeta = null;
		if (enModules[eKey]) {
			const mod = await enModules[eKey]();
			if (mod.metadata?.published) eMeta = { ...mod.metadata, slug };
		}
		if (koModules[kKey]) {
			const mod = await koModules[kKey]();
			if (mod.metadata?.published) kMeta = { ...mod.metadata, slug };
		}
		enSeries.push(eMeta ?? kMeta);
		koSeries.push(kMeta ?? eMeta);
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
	};
}

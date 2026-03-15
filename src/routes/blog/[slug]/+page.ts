export const prerender = true;

import { error } from "@sveltejs/kit";
import { readingTime } from "$lib/readingTime.js";

const enModules = import.meta.glob("../posts/en/*.md");
const koModules = import.meta.glob("../posts/ko/*.md");
const enRawModules = import.meta.glob("../posts/en/*.md", { query: "?raw", import: "default" });
const koRawModules = import.meta.glob("../posts/ko/*.md", { query: "?raw", import: "default" });

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

	const enRaw = enPost && enRawModules[enKey] ? await enRawModules[enKey]() : null;
	const koRaw = koPost && koRawModules[koKey] ? await koRawModules[koKey]() : null;

	const response = await fetch("/api/posts");
	const posts = await response.json();

	const series = posts.filter(
		(tempPost) => tempPost.series === primaryPost.metadata.series,
	);

	const availableLangs = [
		...(enPost ? ["en"] : []),
		...(koPost ? ["ko"] : []),
	];

	return {
		enContent: enPost?.default ?? null,
		koContent: koPost?.default ?? null,
		enMeta: enPost?.metadata ?? null,
		koMeta: koPost?.metadata ?? null,
		meta: primaryPost.metadata,
		series,
		availableLangs,
		enReadingTime: enRaw ? readingTime(enRaw) : null,
		koReadingTime: koRaw ? readingTime(koRaw) : null,
	};
}

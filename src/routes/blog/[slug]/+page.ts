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

	const [enMod, koMod] = await Promise.all([
		enModules[enKey] ? enModules[enKey]() : null,
		koModules[koKey] ? koModules[koKey]() : null,
	]);

	const enPost = enMod?.metadata?.published ? enMod : null;
	const koPost = koMod?.metadata?.published ? koMod : null;

	const primaryPost = enPost || koPost;
	if (!primaryPost) {
		throw error(404, `Could not find ${params.slug}`);
	}

	const [enRaw, koRaw, postsResponse] = await Promise.all([
		enPost && enRawModules[enKey] ? enRawModules[enKey]() : null,
		koPost && koRawModules[koKey] ? koRawModules[koKey]() : null,
		fetch("/api/posts"),
	]);

	const posts = await postsResponse.json();

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
		enReadingTime: enRaw ? readingTime(enRaw, 'en') : null,
		koReadingTime: koRaw ? readingTime(koRaw, 'ko') : null,
	};
}

export const prerender = true;

import { error } from "@sveltejs/kit";
import { readingTime } from "$lib/readingTime.js";

const enModules = import.meta.glob("../projects/en/*.md");
const koModules = import.meta.glob("../projects/ko/*.md");
const enRawModules = import.meta.glob("../projects/en/*.md", { query: "?raw", import: "default" });
const koRawModules = import.meta.glob("../projects/ko/*.md", { query: "?raw", import: "default" });

export async function load({ params }) {
	const enKey = `../projects/en/${params.slug}.md`;
	const koKey = `../projects/ko/${params.slug}.md`;

	const [enMod, koMod] = await Promise.all([
		enModules[enKey] ? enModules[enKey]() : null,
		koModules[koKey] ? koModules[koKey]() : null,
	]);

	const enProject = enMod?.metadata?.published ? enMod : null;
	const koProject = koMod?.metadata?.published ? koMod : null;

	const primaryProject = enProject || koProject;
	if (!primaryProject) {
		throw error(404, `Could not find ${params.slug}`);
	}

	const [enRaw, koRaw] = await Promise.all([
		enProject && enRawModules[enKey] ? enRawModules[enKey]() : null,
		koProject && koRawModules[koKey] ? koRawModules[koKey]() : null,
	]);

	const availableLangs = [
		...(enProject ? ["en"] : []),
		...(koProject ? ["ko"] : []),
	];

	return {
		enContent: enProject?.default ?? null,
		koContent: koProject?.default ?? null,
		enMeta: enProject?.metadata ?? null,
		koMeta: koProject?.metadata ?? null,
		meta: primaryProject.metadata,
		availableLangs,
		enReadingTime: enRaw ? readingTime(enRaw, 'en') : null,
		koReadingTime: koRaw ? readingTime(koRaw, 'ko') : null,
	};
}

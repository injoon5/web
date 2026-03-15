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

	let enProject = null;
	let koProject = null;

	if (enModules[enKey]) {
		const mod = await enModules[enKey]();
		if (mod.metadata?.published) enProject = mod;
	}
	if (koModules[koKey]) {
		const mod = await koModules[koKey]();
		if (mod.metadata?.published) koProject = mod;
	}

	const primaryProject = enProject || koProject;
	if (!primaryProject) {
		throw error(404, `Could not find ${params.slug}`);
	}

	const enRaw = enProject && enRawModules[enKey] ? await enRawModules[enKey]() : null;
	const koRaw = koProject && koRawModules[koKey] ? await koRawModules[koKey]() : null;

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
		enReadingTime: enRaw ? readingTime(enRaw) : null,
		koReadingTime: koRaw ? readingTime(koRaw) : null,
	};
}

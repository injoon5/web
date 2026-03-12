export const prerender = true;

import { error } from "@sveltejs/kit";

const enModules = import.meta.glob("../projects/en/*.md");
const koModules = import.meta.glob("../projects/ko/*.md");

export async function load({ params }) {
	const enKey = `../projects/en/${params.slug}.md`;
	const koKey = `../projects/ko/${params.slug}.md`;

	let enProject = null;
	let koProject = null;

	if (enModules[enKey]) {
		enProject = await enModules[enKey]();
	}
	if (koModules[koKey]) {
		koProject = await koModules[koKey]();
	}

	const primaryProject = enProject || koProject;
	if (!primaryProject) {
		throw error(404, `Could not find ${params.slug}`);
	}

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
	};
}

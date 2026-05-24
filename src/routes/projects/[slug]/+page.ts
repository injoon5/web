// Server-rendered (not prerendered) so the cookie/?lang= preferred language
// is applied on the server — the first byte is the right language, no flash.
export const prerender = false;

import { error } from '@sveltejs/kit';

const enModules = import.meta.glob('../projects/en/*.md');
const koModules = import.meta.glob('../projects/ko/*.md');

export async function load({ params, data }) {
	const enKey = `../projects/en/${params.slug}.md`;
	const koKey = `../projects/ko/${params.slug}.md`;

	const [enMod, koMod] = await Promise.all([
		enModules[enKey] ? enModules[enKey]() : Promise.resolve(null),
		koModules[koKey] ? koModules[koKey]() : Promise.resolve(null)
	]);

	const enProject = enMod?.metadata?.published ? enMod : null;
	const koProject = koMod?.metadata?.published ? koMod : null;

	const primaryProject = enProject || koProject;
	if (!primaryProject) {
		throw error(404, `Could not find ${params.slug}`);
	}

	const availableLangs = [...(koProject ? ['ko'] : []), ...(enProject ? ['en'] : [])];

	return {
		enContent: enProject?.default ?? null,
		koContent: koProject?.default ?? null,
		enMeta: enProject?.metadata ?? null,
		koMeta: koProject?.metadata ?? null,
		meta: primaryProject.metadata,
		availableLangs,
		enReadingTime: enProject?.metadata?.readingTime ?? null,
		koReadingTime: koProject?.metadata?.readingTime ?? null,
		prefLang: data?.prefLang ?? null
	};
}

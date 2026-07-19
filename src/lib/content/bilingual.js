/**
 * Shared en/ko module resolution for the bilingual content pages
 * (blog/[slug] and projects/[slug]).
 *
 * The `import.meta.glob` calls must stay in each route (their patterns are
 * relative to the calling file); this module holds everything downstream of
 * them.
 */

/** @param {string} path */
export const slugFromPath = (path) => path.split('/').at(-1)?.replace('.md', '') ?? '';

/**
 * Load the en/ko modules for one slug and keep only published ones.
 *
 * @param {Record<string, () => Promise<any>>} enModules
 * @param {Record<string, () => Promise<any>>} koModules
 * @param {string} enKey  glob key for the English module
 * @param {string} koKey  glob key for the Korean module
 */
export async function resolveBilingualEntry(enModules, koModules, enKey, koKey) {
	const [enMod, koMod] = await Promise.all([
		enModules[enKey] ? enModules[enKey]() : Promise.resolve(null),
		koModules[koKey] ? koModules[koKey]() : Promise.resolve(null)
	]);

	return {
		en: enMod?.metadata?.published ? enMod : null,
		ko: koMod?.metadata?.published ? koMod : null
	};
}

/**
 * The common page-data shape both content routes return, including the
 * fields forwarded from the server load (prefLang, ipHash).
 *
 * @param {any} en  published English module or null
 * @param {any} ko  published Korean module or null
 * @param {{ prefLang?: string | null, ipHash?: string } | undefined} serverData
 */
export function bilingualPageData(en, ko, serverData) {
	const primary = en || ko;

	return {
		enContent: en?.default ?? null,
		koContent: ko?.default ?? null,
		enMeta: en?.metadata ?? null,
		koMeta: ko?.metadata ?? null,
		meta: primary.metadata,
		availableLangs: [...(ko ? ['ko'] : []), ...(en ? ['en'] : [])],
		enReadingTime: en?.metadata?.readingTime ?? null,
		koReadingTime: ko?.metadata?.readingTime ?? null,
		prefLang: serverData?.prefLang ?? null,
		ipHash: serverData?.ipHash ?? ''
	};
}

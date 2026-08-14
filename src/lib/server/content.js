// @ts-check
import { slugFromPath } from '$lib/content/bilingual.js';
import { blogEnMeta, blogKoMeta, projectEnMeta, projectKoMeta } from './content-modules.js';

/** @typedef {import('$lib/types').Post} Post */
/** @typedef {import('$lib/types').Project} Project */
/** @typedef {Record<string, unknown>} Metadata */

export const CONTENT_CACHE_CONTROL =
	'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

/**
 * Resolve published content items from en/ko metadata glob results.
 * Korean takes precedence when both languages exist for the same slug.
 *
 * The glob values are metadata records, not modules — see content-modules.js.
 *
 * @param {Record<string, unknown>} enPaths
 * @param {Record<string, unknown>} koPaths
 * @returns {Metadata[]}
 */
export function resolvePublished(enPaths, koPaths) {
	/** @type {Set<string>} */
	const enSlugs = new Set();
	for (const path in enPaths) {
		// `hasEn` means "a published English twin exists", not merely that a file
		// does — an unpublished English draft must not surface a language toggle
		// that 404s when followed.
		const metadata = /** @type {Metadata | undefined} */ (enPaths[path]);
		if (metadata?.published === true) {
			const slug = slugFromPath(path);
			if (slug) enSlugs.add(slug);
		}
	}

	/** @type {Record<string, Metadata>} */
	const bySlug = {};
	for (const paths of [enPaths, koPaths]) {
		for (const path in paths) {
			const metadata = /** @type {Metadata | undefined} */ (paths[path]);
			const slug = slugFromPath(path);
			if (metadata && slug) {
				/** @type {Metadata} */
				const item = { ...metadata, slug, hasEn: enSlugs.has(slug) };
				if (item.published === true) bySlug[slug] = item;
			}
		}
	}

	return Object.values(bySlug);
}

/**
 * @param {string | undefined} a
 * @param {string | undefined} b
 */
const byDateDesc = (a, b) => {
	// A missing/unparseable date sorts to the end rather than returning NaN,
	// which would violate the sort contract and scramble the order.
	const ta = new Date(a ?? '').getTime();
	const tb = new Date(b ?? '').getTime();
	return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
};

/**
 * The published post list, newest first. One definition, shared by the page
 * loads and by `/api/posts`.
 * @returns {Post[]}
 */
export function publishedPosts() {
	return /** @type {Post[]} */ (resolvePublished(blogEnMeta, blogKoMeta)).sort((a, b) =>
		byDateDesc(a.date, b.date)
	);
}

/**
 * The published project list, newest first.
 * @returns {Project[]}
 */
export function publishedProjects() {
	return /** @type {Project[]} */ (resolvePublished(projectEnMeta, projectKoMeta)).sort((a, b) =>
		byDateDesc(a.year, b.year)
	);
}

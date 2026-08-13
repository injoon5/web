// @ts-check
import { slugFromPath } from '$lib/content/bilingual.js';

/** The canonical origin. Kept in one place so the sitemap and RSS agree. */
export const SITE_URL = 'https://www.injoon5.com';

/**
 * Static, non-content routes. Priority is advisory — modern crawlers largely
 * ignore it — but the set is the point: `/now` and `/health` never appeared in
 * the old hand-written sitemap at all.
 */
export const STATIC_PAGES = [
	{ path: '/', priority: '1.0' },
	{ path: '/blog', priority: '0.8' },
	{ path: '/projects', priority: '0.8' },
	{ path: '/now', priority: '0.6' },
	{ path: '/health', priority: '0.5' }
];

/**
 * Normalise a frontmatter date (`'2024-05-14'`) or a project year (`'2025'`) to
 * a `YYYY-MM-DD` string for `<lastmod>`. Anything unparseable yields null so the
 * tag is simply omitted rather than shipping `Invalid Date`.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function toIsoDate(value) {
	if (value == null || value === '') return null;
	const date = new Date(/** @type {string} */ (value));
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}

/**
 * Korean is the site default and the language `<loc>` points at, so it leads the
 * alternate list; English follows. Any other language sorts after both.
 *
 * @param {string[]} langs
 */
function orderLangs(langs) {
	const rank = /** @param {string} l */ (l) => (l === 'ko' ? 0 : l === 'en' ? 1 : 2);
	return [...langs].sort((a, b) => rank(a) - rank(b));
}

/**
 * Fold the eager en/ko metadata globs into one sitemap entry per slug, recording
 * which languages published so the entry can carry accurate hreflang alternates
 * — the same contract the `[slug]` pages emit in their `<head>`.
 *
 * @param {Record<string, unknown>} enMeta
 * @param {Record<string, unknown>} koMeta
 * @param {string} pathPrefix  e.g. `/blog`
 * @param {string} dateField   frontmatter field used for lastmod (`date` | `year`)
 * @returns {{ path: string, langs: string[], lastmod: string | null }[]}
 */
export function contentEntries(enMeta, koMeta, pathPrefix, dateField) {
	/** @type {Map<string, { langs: Set<string>, lastmod: string | null }>} */
	const bySlug = new Map();

	for (const [lang, metaByPath] of /** @type {const} */ ([
		['en', enMeta],
		['ko', koMeta]
	])) {
		for (const path in metaByPath) {
			const meta = /** @type {Record<string, unknown> | undefined} */ (metaByPath[path]);
			if (meta?.published !== true) continue;

			const slug = slugFromPath(path);
			if (!slug) continue;

			const entry = bySlug.get(slug) ?? { langs: new Set(), lastmod: null };
			entry.langs.add(lang);

			const iso = toIsoDate(meta[dateField]);
			// The most recent date across the two languages wins the lastmod.
			if (iso && (!entry.lastmod || iso > entry.lastmod)) entry.lastmod = iso;

			bySlug.set(slug, entry);
		}
	}

	return [...bySlug.entries()]
		.sort((a, b) => (b[1].lastmod ?? '').localeCompare(a[1].lastmod ?? ''))
		.map(([slug, entry]) => ({
			path: `${pathPrefix}/${slug}`,
			langs: orderLangs([...entry.langs]),
			lastmod: entry.lastmod
		}));
}

/**
 * Build the full ordered list of sitemap URL records: the static pages first,
 * then every published post and project.
 *
 * @param {object} globs
 * @param {Record<string, unknown>} globs.blogEnMeta
 * @param {Record<string, unknown>} globs.blogKoMeta
 * @param {Record<string, unknown>} globs.projectEnMeta
 * @param {Record<string, unknown>} globs.projectKoMeta
 * @returns {{ path: string, langs?: string[], lastmod?: string | null, priority?: string }[]}
 */
export function sitemapEntries({ blogEnMeta, blogKoMeta, projectEnMeta, projectKoMeta }) {
	return [
		...STATIC_PAGES,
		...contentEntries(blogEnMeta, blogKoMeta, '/blog', 'date'),
		...contentEntries(projectEnMeta, projectKoMeta, '/projects', 'year')
	];
}

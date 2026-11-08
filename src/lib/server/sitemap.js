// @ts-check
import { alternates } from '#lib/content/article-paths.js';
import { DATE_FIELD } from './catalogue.js';

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
 * The sitemap's `<url>` records: the static pages, then one per language of
 * every published article, each bilingual one listing every language as an
 * alternate (and the primary as `x-default`) — the form Google asks for, and the
 * same set the page puts in its own `<head>`.
 *
 * @param {import('./catalogue.js').Catalogue} catalogue
 * @returns {{ loc: string, lastmod?: string | null, priority?: string, alternates: { hreflang: string, path: string }[] }[]}
 */
export function sitemapUrls(catalogue) {
	const articles = [...catalogue.blog, ...catalogue.projects].flatMap((article) => {
		const field = DATE_FIELD[article.kind];
		// The most recent date across the languages is the article's lastmod.
		const lastmod =
			Object.values(article.meta)
				.map((meta) => toIsoDate(meta[field]))
				.filter(Boolean)
				.sort()
				.at(-1) ?? null;
		const links = alternates(article.kind, article.slug, article.langs);
		const listed = links.length > 2 ? links : [];
		return links
			.filter(({ hreflang }) => hreflang !== 'x-default')
			.map(({ path }) => ({ loc: path, lastmod, alternates: listed }));
	});
	return [
		...STATIC_PAGES.map(({ path, priority }) => ({ loc: path, priority, alternates: [] })),
		...articles
	];
}

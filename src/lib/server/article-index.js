// @ts-check
import { slugFromPath } from '#lib/content/bilingual.js';
import { orderLangs } from '#lib/content/article-paths.js';
import {
	blogEnMeta,
	blogKoMeta,
	projectEnMeta,
	projectKoMeta
} from '#lib/server/content-modules.js';
import { allPostSeries } from './series.js';

/**
 * @typedef {import('./series.js').SeriesEntry} SeriesEntry
 * @typedef {{ langs: string[], series?: { en: SeriesEntry[], ko: SeriesEntry[] } }} ArticleEntry
 * @typedef {{ blog: Record<string, ArticleEntry>, projects: Record<string, ArticleEntry> }} ArticleIndex
 */

/**
 * Which languages each published article has, and each post's series lists.
 * What an article's load needs before it can pick a content chunk, without
 * importing the chunks themselves: a module imported eagerly anywhere in the
 * client bundle drags every post into one chunk (see "Content Lists" in
 * CLAUDE.md), so the browser reads this as JSON (`/api/articles.json`).
 *
 * @param {Record<string, unknown>} enMeta
 * @param {Record<string, unknown>} koMeta
 * @returns {Record<string, ArticleEntry>}
 */
function languagesBySlug(enMeta, koMeta) {
	/** @type {Map<string, string[]>} */
	const langs = new Map();
	for (const [lang, metaByPath] of /** @type {const} */ ([
		['en', enMeta],
		['ko', koMeta]
	])) {
		for (const path in metaByPath) {
			const meta = /** @type {Record<string, unknown> | undefined} */ (metaByPath[path]);
			if (meta?.published !== true) continue;
			const slug = slugFromPath(path);
			langs.set(slug, [...(langs.get(slug) ?? []), lang]);
		}
	}
	/** @type {Record<string, ArticleEntry>} */
	const out = {};
	for (const slug of [...langs.keys()].sort()) {
		out[slug] = { langs: orderLangs(/** @type {string[]} */ (langs.get(slug))) };
	}
	return out;
}

/** @returns {ArticleIndex} */
export function buildArticleIndex({
	blogEnMeta: be = blogEnMeta,
	blogKoMeta: bk = blogKoMeta,
	projectEnMeta: pe = projectEnMeta,
	projectKoMeta: pk = projectKoMeta
} = {}) {
	const blog = languagesBySlug(be, bk);
	for (const [slug, { enSeries, koSeries }] of Object.entries(allPostSeries(be, bk))) {
		if (blog[slug]) blog[slug].series = { en: enSeries, ko: koSeries };
	}
	return { blog, projects: languagesBySlug(pe, pk) };
}

export const articleIndex = buildArticleIndex();

/**
 * Prerender entries for an article route: every published article at its bare
 * URL and at `/en`. `/en` exists even for a Korean-only post (rendering Korean,
 * canonical to the bare URL), so the cookie redirect in vercel.json can send any
 * article there without knowing which ones were translated.
 *
 * @param {'blog' | 'projects'} kind
 */
export function articleEntries(kind) {
	return Object.keys(articleIndex[kind]).flatMap((slug) => [{ slug }, { slug, lang: 'en' }]);
}

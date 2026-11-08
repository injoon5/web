// @ts-check
import { catalogue as siteCatalogue } from './catalogue.js';
import { seriesBySlug } from './series.js';

/**
 * @typedef {import('./series.js').Series} Series
 * @typedef {{ langs: string[], series?: Series }} ArticleEntry
 * @typedef {{ blog: Record<string, ArticleEntry>, projects: Record<string, ArticleEntry> }} ArticleIndex
 */

/**
 * Which languages each published article has, and each post's series lists.
 * What an article's load needs before it can pick a content chunk, without
 * importing the chunks themselves: a module imported eagerly anywhere in the
 * client bundle drags every post into one chunk (see "Content Lists" in
 * CLAUDE.md), so the browser reads this as JSON (`/api/articles.json`).
 *
 * @param {import('./catalogue.js').Catalogue} catalogue
 * @returns {ArticleIndex}
 */
export function buildArticleIndex(catalogue) {
	const series = seriesBySlug(catalogue.blog);
	/** @param {import('./catalogue.js').Article[]} articles */
	const index = (articles) =>
		Object.fromEntries(
			articles.map(({ slug, langs }) => [
				slug,
				series[slug] ? { langs, series: series[slug] } : { langs }
			])
		);
	return { blog: index(catalogue.blog), projects: index(catalogue.projects) };
}

export const articleIndex = buildArticleIndex(siteCatalogue);

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

/**
 * Whether `url` is the bare URL of a published article: what likes and comments
 * are keyed by, so the only URLs they may be written under.
 *
 * @param {string} url
 */
export function isArticleUrl(url) {
	const match = /^\/(blog|projects)\/([^/]+)$/.exec(url);
	return (
		!!match && Object.hasOwn(articleIndex[/** @type {'blog' | 'projects'} */ (match[1])], match[2])
	);
}

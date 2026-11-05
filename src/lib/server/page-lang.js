// @ts-check
import { articleIndex } from './article-index.js';
import { resolveLang } from '#lib/content/article-paths.js';

const ARTICLE = /^\/(blog|projects)\/([^/]+)(?:\/(en))?\/?$/;

/**
 * The language of the page at `pathname`, for `<html lang>`: an article's is in
 * its URL (`#lib/content/article-paths.js`), everything else is English chrome.
 * Runs while prerendering too, which is when every article is built.
 *
 * @param {string} pathname
 * @param {import('./article-index.js').ArticleIndex} [index]
 */
export function pageLang(pathname, index = articleIndex) {
	const match = ARTICLE.exec(pathname);
	const entry = match && index[/** @type {'blog' | 'projects'} */ (match[1])][match[2]];
	return match && entry ? resolveLang(match[3], entry.langs) : 'en';
}

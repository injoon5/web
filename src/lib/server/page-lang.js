// @ts-check
import { articleIndex } from './article-index.js';
import { parseArticlePath, resolveLang } from '#lib/content/article-paths.js';

/**
 * The language of the page at `pathname`, for `<html lang>`: an article's is in
 * its URL (`#lib/content/article-paths.js`), everything else is English chrome.
 * Runs while prerendering too, which is when every article is built.
 *
 * @param {string} pathname
 * @param {import('./article-index.js').ArticleIndex} [index]
 */
export function pageLang(pathname, index = articleIndex) {
	const article = parseArticlePath(pathname);
	const entry = article && index[article.kind][article.slug];
	return article && entry ? resolveLang(article.lang, entry.langs) : 'en';
}

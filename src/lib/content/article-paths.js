/**
 * Where each language of an article lives. Korean is the site's default, so a
 * post's primary language is Korean when it has one, and that language is the
 * bare URL; the other is the same URL plus `/en`. Shared by the server (index,
 * hooks, sitemap) and the browser (load, switcher), so the two cannot disagree.
 */

/** @typedef {'blog' | 'projects'} ArticleKind */

/** The canonical origin, which every absolute URL in a page's head is built on. */
export const SITE_URL = 'https://www.injoon5.com';

/** Display order: Korean leads, so `langs[0]` is the primary language. */
const RANK = { ko: 0, en: 1 };

/** @param {string[]} langs */
export function orderLangs(langs) {
	return [...langs].sort((a, b) => (RANK[a] ?? 2) - (RANK[b] ?? 2));
}

/** @param {ArticleKind} kind @param {string} slug */
export function articleBase(kind, slug) {
	return `/${kind}/${slug}`;
}

/**
 * The language a URL asks for, or the primary one when it asks for nothing or
 * for one the article does not have.
 *
 * @param {string | undefined | null} requested  the `[[lang]]` param
 * @param {string[]} langs  in display order
 */
export function resolveLang(requested, langs) {
	return requested && langs.includes(requested) ? requested : langs[0];
}

/**
 * The canonical URL of one language of an article.
 *
 * @param {ArticleKind} kind
 * @param {string} slug
 * @param {string} lang
 * @param {string[]} langs  in display order
 */
export function articlePath(kind, slug, lang, langs) {
	const base = articleBase(kind, slug);
	return lang === langs[0] ? base : `${base}/${lang}`;
}

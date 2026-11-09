// @ts-check
import { catalogue, primaryMeta } from './catalogue.js';

/** @typedef {import('#lib/types.js').Post} Post */
/** @typedef {import('#lib/types.js').Project} Project */
/** @typedef {import('./catalogue.js').Article} Article */

/**
 * An article as a listing shows it: in its primary language, which `lang`
 * names so the title can say so (Korean wraps by word, `:lang(ko)` in app.css).
 * `hasEn` means a published English version exists.
 *
 * @param {Article} article
 */
export function listingItem(article) {
	return {
		...primaryMeta(article),
		slug: article.slug,
		lang: article.langs[0],
		hasEn: article.langs.includes('en')
	};
}

/** The published post list, newest first. @returns {Post[]} */
export function publishedPosts() {
	return /** @type {Post[]} */ (catalogue.blog.map(listingItem));
}

/** The published project list, newest first. @returns {Project[]} */
export function publishedProjects() {
	return /** @type {Project[]} */ (catalogue.projects.map(listingItem));
}

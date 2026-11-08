// @ts-check
import { orderLangs } from '#lib/content/article-paths.js';
import { metadataGlobs } from './content-modules.js';

/** @typedef {import('#lib/content/article-paths.js').ArticleKind} ArticleKind */
/** @typedef {Record<string, any>} Metadata */
/**
 * One published article: the languages it is published in (primary first) and
 * its metadata in each of them.
 * @typedef {{ kind: ArticleKind, slug: string, langs: string[], meta: Record<string, Metadata> }} Article
 */
/** @typedef {Record<ArticleKind, Record<string, Record<string, unknown>>>} Globs */
/** @typedef {Record<ArticleKind, Article[]>} Catalogue */

/** The frontmatter field an article is dated by. */
export const DATE_FIELD = { blog: 'date', projects: 'year' };

/** `/src/content/blog/ko/us-camp.md` → `us-camp` */
const slugFromPath = (/** @type {string} */ path) =>
	path.split('/').at(-1)?.replace(/\.md$/, '') ?? '';

/** Milliseconds, or 0 for a missing or unparseable date, so it sorts last. */
export function timeOf(/** @type {unknown} */ value) {
	const time = new Date(/** @type {string} */ (value ?? '')).getTime();
	return Number.isNaN(time) ? 0 : time;
}

/** @param {Article} article */
export const primaryMeta = (article) => article.meta[article.langs[0]];

/**
 * Every published article of one kind, newest first by its primary language's
 * date. "Published" is `published: true` in that language's frontmatter: an
 * unpublished translation is not a language the article has.
 *
 * @param {ArticleKind} kind
 * @param {Record<string, Record<string, unknown>>} globsByLang  lang -> eager metadata glob
 * @returns {Article[]}
 */
function articlesOf(kind, globsByLang) {
	/** @type {Map<string, Record<string, Metadata>>} */
	const bySlug = new Map();
	for (const [lang, glob] of Object.entries(globsByLang)) {
		for (const [path, meta] of Object.entries(glob)) {
			const slug = slugFromPath(path);
			if (!slug || /** @type {Metadata | undefined} */ (meta)?.published !== true) continue;
			bySlug.set(slug, { ...bySlug.get(slug), [lang]: /** @type {Metadata} */ (meta) });
		}
	}

	const field = DATE_FIELD[kind];
	return [...bySlug]
		.map(([slug, meta]) => ({ kind, slug, langs: orderLangs(Object.keys(meta)), meta }))
		.sort(
			(a, b) =>
				timeOf(primaryMeta(b)[field]) - timeOf(primaryMeta(a)[field]) ||
				a.slug.localeCompare(b.slug)
		);
}

/** @param {Globs} globs @returns {Catalogue} */
export function buildCatalogue(globs) {
	return { blog: articlesOf('blog', globs.blog), projects: articlesOf('projects', globs.projects) };
}

/** Every published article on the site. */
export const catalogue = buildCatalogue(/** @type {Globs} */ (metadataGlobs));

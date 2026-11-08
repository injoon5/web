/**
 * The lazy content globs, shared by the `[slug]` loads and the listings that
 * preload them, so both import the same chunks. Lazy only: never glob these
 * files eagerly into a client bundle (see "Content Lists" in CLAUDE.md).
 */

const modules = {
	blog: {
		en: import.meta.glob('/src/content/blog/en/*.md'),
		ko: import.meta.glob('/src/content/blog/ko/*.md')
	},
	projects: {
		en: import.meta.glob('/src/content/projects/en/*.md'),
		ko: import.meta.glob('/src/content/projects/ko/*.md')
	}
};

/**
 * The import of one language of an article's compiled markdown, or undefined
 * when there is no such file.
 *
 * @param {import('./article-paths.js').ArticleKind} kind
 * @param {string} lang
 * @param {string} slug
 * @returns {(() => Promise<any>) | undefined}
 */
export function articleModule(kind, lang, slug) {
	return modules[kind][lang]?.[`/src/content/${kind}/${lang}/${slug}.md`];
}

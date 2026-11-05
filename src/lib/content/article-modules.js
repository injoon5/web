/**
 * The lazy content globs, shared by the `[slug]` loads and the listings that
 * preload them, so both import the same chunks. Lazy only: never glob these
 * files eagerly into a client bundle (see "Content Lists" in CLAUDE.md).
 */

export const blogModules = {
	en: import.meta.glob('/src/content/blog/en/*.md'),
	ko: import.meta.glob('/src/content/blog/ko/*.md')
};

export const projectModules = {
	en: import.meta.glob('/src/content/projects/en/*.md'),
	ko: import.meta.glob('/src/content/projects/ko/*.md')
};

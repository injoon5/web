/**
 * Single home for the eagerly-loaded content module globs. Every consumer of
 * blog/project markdown metadata (listing APIs, valid-URL guard, RSS feed)
 * imports from here instead of re-globbing.
 */

export const blogEnModules = import.meta.glob('/src/routes/blog/posts/en/*.md', { eager: true });
export const blogKoModules = import.meta.glob('/src/routes/blog/posts/ko/*.md', { eager: true });
export const projectEnModules = import.meta.glob('/src/routes/projects/projects/en/*.md', {
	eager: true
});
export const projectKoModules = import.meta.glob('/src/routes/projects/projects/ko/*.md', {
	eager: true
});

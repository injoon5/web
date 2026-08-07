/**
 * Single home for the eager content metadata globs. Values are the metadata
 * records themselves, not modules.
 *
 * Both halves of the options matter. `import: 'metadata'` keeps the compiled
 * Svelte component for every post out of anything that imports this — Rollup
 * cannot drop exports it can't see through a namespace object.
 *
 * And the options object MUST be written out literally at each call.
 * `import.meta.glob` is a compile-time transform, so hoisting it into a shared
 * `const` silently falls back to a lazy glob whose values are import
 * *functions*. Nothing throws — `metadata.published` is `undefined` on a
 * function — so every post reads as unpublished and the RSS feed, the listing
 * APIs and the valid-URL guard all quietly go empty. Check
 * `prerendered/pages/rss.xml` has items after a build if you touch this.
 */

export const blogEnMeta = import.meta.glob('/src/content/blog/en/*.md', {
	eager: true,
	import: 'metadata'
});
export const blogKoMeta = import.meta.glob('/src/content/blog/ko/*.md', {
	eager: true,
	import: 'metadata'
});
export const projectEnMeta = import.meta.glob('/src/content/projects/en/*.md', {
	eager: true,
	import: 'metadata'
});
export const projectKoMeta = import.meta.glob('/src/content/projects/ko/*.md', {
	eager: true,
	import: 'metadata'
});

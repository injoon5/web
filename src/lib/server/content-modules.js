/**
 * Single home for the eagerly-loaded content metadata globs. Every consumer of
 * blog/project markdown metadata (listing APIs, valid-URL guard, RSS feed)
 * imports from here instead of re-globbing.
 *
 * `import: 'metadata'` matters, and not only for size. Without it the glob
 * yields whole module namespace objects, which get passed around as values —
 * and Rollup cannot drop individual exports from a namespace object it can't
 * see through. So the compiled Svelte component for every post and project was
 * pulled into whatever imported this, including `valid-urls.js`, which the
 * comment and like API routes use for nothing more than a set of URL strings.
 * Naming the export lets the components tree-shake back out.
 *
 * Values here are the metadata records themselves, not modules.
 *
 * The options object has to be written out at each call. `import.meta.glob` is
 * a compile-time transform, so Vite has to read the options literally — hoist
 * them into a shared `const` and it silently falls back to a lazy glob, whose
 * values are import *functions*. Nothing throws: `metadata.published` is
 * `undefined` on a function, so every post reads as unpublished and the feed,
 * the listing APIs and the valid-URL guard all quietly go empty.
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

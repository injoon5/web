import { defineParams } from '@sveltejs/kit/params';

/**
 * Route param matchers (SvelteKit 3: one module, `defineParams`; a matcher
 * returns the value, or `undefined` to not match).
 */
export const params = defineParams({
	// The only language that is ever a path segment. Korean is the bare URL; see
	// `#lib/content/article-paths.js`.
	lang: (param) => (param === 'en' ? param : undefined)
});

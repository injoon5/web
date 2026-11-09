import { blur } from 'svelte/transition';

/**
 * The blur one language's text leaves and the other's arrives with when an
 * article switches language. A zero duration (reduced motion, or the first
 * render) is no transition at all rather than an instant one.
 *
 * @param {Element} node
 * @param {import('svelte/transition').BlurParams | null | undefined} params
 */
export function swapBlur(node, params) {
	return params?.duration ? blur(node, params) : {};
}

/**
 * Give a post the stylesheets its markdown needs, and no others.
 *
 * - A fenced code block reads its colours from `code-theme.css` — one class
 *   per token, the palette for both themes there.
 * - Math is KaTeX markup (`remark-math` 3 + `rehype-katex-svelte`), which is a
 *   pile of absolutely positioned spans that mean nothing without KaTeX's own
 *   sheet. It rendered unstyled until this: nothing loaded it.
 *
 * Both are imported by the posts that use them rather than shipped in
 * `app.css` to every page. Runs before mdsvex's own highlight step, which is
 * what turns the `code` nodes into HTML.
 */

import { CODE_THEME_CSS_PATH } from './code-theme.js';
import { addSideEffectImport } from './splice-import.js';

/**
 * The same package `rehype-katex-svelte` renders with — `katex` is declared at
 * its version, so the markup and the sheet cannot drift apart.
 */
export const KATEX_CSS_PATH = 'katex/dist/katex.min.css';

/** mdast node type → the stylesheet a post containing one needs. */
const SHEETS = new Map([
	['code', CODE_THEME_CSS_PATH],
	['math', KATEX_CSS_PATH],
	['inlineMath', KATEX_CSS_PATH]
]);

/**
 * @param {any} node
 * @param {Set<string>} found
 */
function collect(node, found) {
	const sheet = SHEETS.get(node.type);
	if (sheet) found.add(sheet);
	for (const child of node.children ?? []) collect(child, found);
}

export function remarkStylesheets() {
	/** @param {any} tree */
	return (tree) => {
		/** @type {Set<string>} */
		const found = new Set();
		collect(tree, found);
		for (const path of found) addSideEffectImport(tree, path);
	};
}

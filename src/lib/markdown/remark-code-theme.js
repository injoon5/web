/**
 * Give a post with a fenced code block the stylesheet its tokens read.
 *
 * Each token carries one `var(--code-*)` and `code-theme.css` defines the
 * palette for both themes. It is ~8KB, so it is imported by the posts that have
 * code rather than shipped in `app.css` to every page. Runs before mdsvex's own
 * highlight step, which is what turns the `code` nodes into HTML.
 */

import { CODE_THEME_CSS_PATH } from './code-theme.js';
import { addSideEffectImport } from './splice-import.js';

/**
 * @param {any} node
 * @returns {boolean}
 */
const hasCode = (node) => node.type === 'code' || (node.children ?? []).some(hasCode);

export function remarkCodeTheme() {
	/** @param {any} tree */
	return (tree) => {
		if (hasCode(tree)) addSideEffectImport(tree, CODE_THEME_CSS_PATH);
	};
}

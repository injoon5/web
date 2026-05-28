import { visit } from 'unist-util-visit';

/** Remove tabindex from pretty-code <pre> nodes (breaks Svelte a11y checks on .md routes). */
export function rehypeStripCodeTabindex() {
	return (tree) => {
		visit(tree, 'element', (node) => {
			if (node.tagName === 'pre' && node.properties != null) {
				delete node.properties.tabIndex;
				delete node.properties.tabindex;
			}
		});
	};
}

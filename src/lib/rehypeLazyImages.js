import { visit } from 'unist-util-visit';

/** Add loading="lazy" and decoding="async" to all markdown images. */
export function rehypeLazyImages() {
	return (tree) => {
		visit(tree, 'element', (node) => {
			if (node.tagName === 'img') {
				node.properties = node.properties ?? {};
				node.properties.loading = node.properties.loading ?? 'lazy';
				node.properties.decoding = node.properties.decoding ?? 'async';
			}
		});
	};
}

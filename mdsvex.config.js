import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatexSvelte from 'rehype-katex-svelte';
import rehypeSlug from 'rehype-slug';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkGemoji from 'remark-gemoji';
import remarkEmbedder from '@remark-embedder/core';
import oembedTransformer from '@remark-embedder/transformer-oembed';
import rehypeFigure from 'rehype-figure';
import rehypeExternalLinks from 'rehype-external-links';
import { createHighlighter } from '@svelte-dev/pretty-code';
import { visit } from 'unist-util-visit';

function remarkEnhancedImages() {
	return function (tree) {
		visit(tree, 'image', function (node, index, parent) {
			const src = node.url;
			if (!src || !src.startsWith('/images/')) return;

			const libSrc = '$lib' + src;
			const alt = (node.alt || '').replace(/"/g, '&quot;');

			parent.children[index] = {
				type: 'html',
				value: `<enhanced:img src="${libSrc}" alt="${alt}" loading="lazy" />`
			};
		});
	};
}

const config = {
	extensions: ['.md'],
	highlight: {
		highlighter: createHighlighter({
			// keepBackground: false,
			theme: 'github-dark'
		})
	},
	smartypants: {
		dashes: 'oldschool'
	},
	remarkPlugins: [
		remarkMath,
		remarkGfm,
		remarkGemoji,
		[remarkEmbedder.default, {
			transformers: [oembedTransformer.default],
			handleError: ({ error, url }) => {
				console.warn(`remark-embedder: failed to embed ${url}: ${error.message}`);
				return `<a href="${url}">${url}</a>`;
			}
		}],
		remarkEnhancedImages
	],
	rehypePlugins: [
		rehypeKatexSvelte,
		rehypeSlug,
		rehypeFigure,
		[rehypeExternalLinks, { target: ['_blank'], rel: ['noopener noreferrer'] }],
		[rehypeAutolinkHeadings, { behavior: 'append', content: { type: 'text', value: '#' } }]
	]
};

export default config;

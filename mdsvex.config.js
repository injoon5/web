import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatexSvelte from 'rehype-katex-svelte';
import rehypeSlug from 'rehype-slug';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkGemoji from 'remark-gemoji';
import remarkEmbedder from '@remark-embedder/core';
import oembedTransformer from '@remark-embedder/transformer-oembed';
// import enhancedImage from '@lzinga/mdsvex-enhanced-image';
import rehypeFigure from 'rehype-figure';
import rehypeExternalLinks from 'rehype-external-links';
import { createHighlighter } from './src/lib/markdown/pretty-code-highlighter.js';
import { remarkReadingTime } from './src/lib/markdown/remark-reading-time.js';
import { remarkGallery } from './src/lib/markdown/remark-gallery.js';
import { rehypeStripCodeTabindex } from './src/lib/markdown/rehype-strip-code-tabindex.js';

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
		remarkReadingTime,
		// Ahead of rehype, so rehype-figure never sees the images it consumes and
		// the gallery keeps its own caption instead of getting four <figure>s.
		remarkGallery,
		remarkMath,
		remarkGfm,
		remarkGemoji,
		[
			remarkEmbedder.default,
			{
				transformers: [oembedTransformer.default],
				handleError: ({ error, url }) => {
					console.error(`Failed to embed ${url}:`, error);
					return `<a href="${url}">${url}</a>`;
				}
			}
		]
		// [enhancedImage, { attributes: { loading: 'lazy', fetchpriority: 'low' } }]
	],
	rehypePlugins: [
		rehypeKatexSvelte,
		rehypeSlug,
		rehypeFigure,
		[rehypeExternalLinks, { target: ['_blank'], rel: ['noopener noreferrer'] }],
		[rehypeAutolinkHeadings, { behavior: 'append', content: { type: 'text', value: '#' } }],
		rehypeStripCodeTabindex
	]
};

export default config;

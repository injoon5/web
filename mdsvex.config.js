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
import { highlight } from './src/lib/markdown/code-highlighter.js';
import { remarkReadingTime } from './src/lib/markdown/remark-reading-time.js';
import { remarkGallery } from './src/lib/markdown/remark-gallery.js';
import { remarkImageSize } from './src/lib/markdown/remark-image-size.js';
import { remarkLazyVideo } from './src/lib/markdown/remark-lazy-video.js';
import { remarkCodeTheme } from './src/lib/markdown/remark-code-theme.js';

const config = {
	extensions: ['.md'],
	highlight: {
		highlighter: highlight
	},
	smartypants: {
		dashes: 'oldschool'
	},
	remarkPlugins: [
		remarkReadingTime,
		// Ahead of the gallery, which lifts the sizes it measures onto its slides.
		remarkImageSize,
		// ...and ahead of it too, or a video written as an image joins a photo strip.
		remarkLazyVideo,
		// Ahead of rehype, so rehype-figure never sees the images it consumes and
		// the gallery keeps its own caption instead of getting four <figure>s.
		remarkGallery,
		// Any plugin order works: mdsvex highlights after every remark plugin.
		remarkCodeTheme,
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
		[rehypeAutolinkHeadings, { behavior: 'append', content: { type: 'text', value: '#' } }]
	]
};

export default config;

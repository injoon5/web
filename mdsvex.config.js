import path from 'path';
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
import rehypePrettyCode from 'rehype-pretty-code';
import { createHighlighter } from '@svelte-dev/pretty-code';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
		[remarkEmbedder.default, { transformers: [oembedTransformer.default] }]
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

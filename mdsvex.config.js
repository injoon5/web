import path from 'path';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatexSvelte from 'rehype-katex-svelte';
import rehypeSlug from 'rehype-slug';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeFigure from 'rehype-figure';
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
	remarkPlugins: [remarkMath, remarkGfm],
	rehypePlugins: [rehypeKatexSvelte, rehypeSlug, rehypeFigure, [rehypeAutolinkHeadings, { behavior: 'prepend' , content: { type: 'text', value: '#' }}]]
};

export default config;
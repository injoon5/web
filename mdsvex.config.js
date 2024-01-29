import path from 'path';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatexSvelte from 'rehype-katex-svelte';
import rehypeSlug from 'rehype-slug';
import remarkAbbr from 'remark-abbr';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
	extensions: ['.md'],
	smartypants: {
		dashes: 'oldschool'
	},
	remarkPlugins: [remarkMath, remarkGfm],
	rehypePlugins: [
		rehypeKatexSvelte,
		rehypeSlug,
		[rehypePrettyCode, { theme: 'material-theme' }],
		[rehypeAutolinkHeadings, { behavior: 'after' }]
	]
};

export default config;

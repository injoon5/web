import rehypePrettyCode from 'rehype-pretty-code';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * mdsvex highlighter backed by rehype-pretty-code.
 *
 * This used to come from `@svelte-dev/pretty-code`, a ~20-line wrapper pinned to
 * rehype-pretty-code 0.12, which pins the deprecated `shikiji`. Inlining it lets
 * the highlighter track rehype-pretty-code/shiki directly.
 */

/**
 * Escape curlies and backticks so the HTML survives `{@html ...}` in a
 * `.svelte` module.
 *
 * @see https://github.com/pngwn/MDsveX/blob/main/packages/mdsvex/src/transformers/index.ts
 * @param {string} str
 * @returns {string}
 */
const escapeSvelte = (str) =>
	str
		.replace(
			/[{}`]/g,
			(c) =>
				/** @type {Record<string, string>} */ ({ '{': '&#123;', '}': '&#125;', '`': '&#96;' })[c]
		)
		.replace(/\\([trn])/g, '&#92;$1');

/**
 * @param {import('rehype-pretty-code').Options} [options]
 * @returns {(code: string, lang: string | null, meta: string | null) => Promise<string>}
 */
export function createHighlighter(options) {
	const processor = unified()
		.use(remarkParse)
		.use(remarkRehype)
		.use(rehypePrettyCode, options)
		.use(rehypeStringify);

	return async function highlighter(code, lang, meta) {
		const html = await processor.process(`\`\`\`${lang ?? ''} ${meta ?? ''}\n${code}\n\`\`\``);
		return escapeSvelte(String(html));
	};
}

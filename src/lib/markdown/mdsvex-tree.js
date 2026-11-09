import { compile } from 'mdsvex';
import mdsvexConfig from '../../../mdsvex.config.js';

/**
 * For tests: the mdast a post's remark plugins leave behind, parsed the way the
 * site parses it.
 *
 * mdsvex 0.12 parses with its own bundled, pre-micromark `remark-parse`, and
 * runs its own transforms (frontmatter, smartypants, escaping) ahead of the
 * configured plugins. A plugin tested against current `remark-parse` instead
 * can pass against trees no post ever produces — and the micromark-era parser
 * cannot load `remark-math` 3 or `remark-footnotes` 2 at all.
 *
 * `plugins` takes the same entries as `remarkPlugins` (a plugin, or
 * `[plugin, options]`). The tree is captured after the last of them, before
 * mdsvex highlights code and hands off to rehype.
 *
 * @param {string} markdown
 * @param {any[]} plugins
 * @param {string} [filename]
 * @returns {Promise<any>}
 */
export async function mdsvexTree(markdown, plugins, filename = '/src/content/blog/en/post.md') {
	/** @type {any} */
	let tree;
	const capture = () => (/** @type {any} */ node) => {
		tree = node;
	};
	await compile(markdown, {
		filename,
		// Without it mdsvex skips a `.md` file and answers undefined.
		extensions: ['.md'],
		smartypants: mdsvexConfig.smartypants,
		remarkPlugins: [...plugins, capture]
	});
	if (!tree) throw new Error('mdsvex compiled nothing');
	return tree;
}

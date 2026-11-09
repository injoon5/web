import { describe, it, expect } from 'vitest';
import remarkMath from 'remark-math';
import { mdsvexTree } from './mdsvex-tree.js';
import { remarkStylesheets } from './remark-stylesheets.js';

/** In the site's order: `remarkMath` registers its tokenizers with the parser. */
const run = (markdown) => mdsvexTree(markdown, [remarkStylesheets, remarkMath]);

const scripts = (tree) =>
	tree.children.filter((n) => n.type === 'html' && n.value.trimStart().startsWith('<script'));

describe('remarkStylesheets', () => {
	it('imports the code palette into a post with a code block', async () => {
		const [script] = scripts(await run('Text\n\n```js\nx\n```\n'));
		expect(script.value).toContain("import '#lib/markdown/code-theme.css';");
		expect(script.value).not.toContain('katex');
	});

	it('imports KaTeX into a post with math, and preloads its fonts', async () => {
		const tree = await run('Text\n\n$$\nx^2\n$$\n');
		const [script] = scripts(tree);
		expect(script.value).toContain("import 'katex/dist/katex.min.css';");
		expect(script.value).toContain("import KatexFonts from '#lib/markdown/KatexFonts.svelte';");
		expect(script.value).not.toContain('code-theme');
		expect(tree.children.some((n) => n.type === 'html' && n.value === '<KatexFonts />')).toBe(true);
	});

	it('preloads no fonts for a post without math', async () => {
		const tree = await run('Text\n\n```js\nx\n```\n');
		expect(JSON.stringify(tree)).not.toContain('KatexFonts');
	});

	it('finds a code block nested in a list', async () => {
		expect(scripts(await run('- item\n\n  ```js\n  x\n  ```\n'))).toHaveLength(1);
	});

	it('adds to the existing instance script rather than a second one', async () => {
		const tree = await run(
			"<script>\n\timport A from './a.js';\n</script>\n\n```js\nx\n```\n\nInline $x^2$.\n"
		);
		const [script] = scripts(tree);
		expect(scripts(tree)).toHaveLength(1);
		expect(script.value).toContain("import '#lib/markdown/code-theme.css';");
		expect(script.value).toContain("import 'katex/dist/katex.min.css';");
		expect(script.value).toContain("import A from './a.js';");
	});

	it('leaves a post with neither alone', async () => {
		expect(scripts(await run('Just `inline` code.\n'))).toHaveLength(0);
	});
});

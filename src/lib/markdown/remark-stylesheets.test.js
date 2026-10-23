import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkStylesheets } from './remark-stylesheets.js';

function run(markdown, before = []) {
	let processor = unified().use(remarkParse);
	for (const plugin of before) processor = processor.use(plugin);
	processor = processor.use(remarkStylesheets);
	return processor.runSync(processor.parse(markdown));
}

const scripts = (tree) =>
	tree.children.filter((n) => n.type === 'html' && n.value.trimStart().startsWith('<script'));

/** Stand-in for remark-math 3, whose tokenizers only the old parser can load. */
const fakeMath = () => (tree) => {
	tree.children.push({ type: 'math', value: 'x^2' });
};

describe('remarkStylesheets', () => {
	it('imports the code palette into a post with a code block', () => {
		const [script] = scripts(run('Text\n\n```js\nx\n```\n'));
		expect(script.value).toContain("import '#lib/markdown/code-theme.css';");
		expect(script.value).not.toContain('katex');
	});

	it('imports KaTeX into a post with math', () => {
		const [script] = scripts(run('Text\n', [fakeMath]));
		expect(script.value).toContain("import 'katex/dist/katex.min.css';");
		expect(script.value).not.toContain('code-theme');
	});

	it('finds a code block nested in a list', () => {
		expect(scripts(run('- item\n\n  ```js\n  x\n  ```\n'))).toHaveLength(1);
	});

	it('adds to the existing instance script rather than a second one', () => {
		const tree = run("<script>\n\timport A from './a.js';\n</script>\n\n```js\nx\n```\n", [
			fakeMath
		]);
		const [script] = scripts(tree);
		expect(scripts(tree)).toHaveLength(1);
		expect(script.value).toContain("import '#lib/markdown/code-theme.css';");
		expect(script.value).toContain("import 'katex/dist/katex.min.css';");
		expect(script.value).toContain("import A from './a.js';");
	});

	it('leaves a post with neither alone', () => {
		expect(scripts(run('Just `inline` code.\n'))).toHaveLength(0);
	});
});

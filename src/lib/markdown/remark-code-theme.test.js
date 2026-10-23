import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkCodeTheme } from './remark-code-theme.js';

function run(markdown) {
	const processor = unified().use(remarkParse).use(remarkCodeTheme);
	return processor.runSync(processor.parse(markdown));
}

const scripts = (tree) =>
	tree.children.filter((n) => n.type === 'html' && n.value.trimStart().startsWith('<script'));

describe('remarkCodeTheme', () => {
	it('imports the palette into a post with a code block', () => {
		const [script] = scripts(run('Text\n\n```js\nx\n```\n'));
		expect(script.value).toContain("import '#lib/markdown/code-theme.css';");
	});

	it('finds a code block nested in a list', () => {
		expect(scripts(run('- item\n\n  ```js\n  x\n  ```\n'))).toHaveLength(1);
	});

	it('adds to the existing instance script rather than a second one', () => {
		const tree = run("<script>\n\timport A from './a.js';\n</script>\n\n```js\nx\n```\n");
		const [script] = scripts(tree);
		expect(scripts(tree)).toHaveLength(1);
		expect(script.value).toContain("import '#lib/markdown/code-theme.css';");
		expect(script.value).toContain("import A from './a.js';");
	});

	it('leaves a post without code alone', () => {
		expect(scripts(run('Just `inline` code.\n'))).toHaveLength(0);
	});
});

import { describe, it, expect } from 'vitest';
import { highlight, parseMeta } from './code-highlighter.js';

const lines = (html) => html.match(/<span data-line=""[^>]*>/g) ?? [];

describe('parseMeta', () => {
	it('reads line ranges, title, caption and line numbers', () => {
		const meta = parseMeta('{1,3-4} title="layout.tsx" caption=\'A caption\' showLineNumbers');
		expect([...meta.highlighted]).toEqual([1, 3, 4]);
		expect(meta.title).toBe('layout.tsx');
		expect(meta.caption).toBe('A caption');
		expect(meta.lineNumbers).toBe(true);
	});

	it('is empty for no meta', () => {
		expect(parseMeta(null)).toEqual({
			highlighted: new Set(),
			title: undefined,
			caption: undefined,
			lineNumbers: false
		});
	});
});

describe('highlight', () => {
	it('emits one line per source line, each token a palette class', () => {
		const html = highlight('const a = 1;\nlet b = 2;', 'ts', null);
		expect(lines(html)).toHaveLength(2);
		expect(html).toMatch(/<span class="t\d+">const <\/span>/);
		expect(html).not.toContain('style=');
	});

	it('merges adjacent tokens of one colour and leaves the foreground bare', () => {
		const html = highlight('a b c', null, null);
		expect(html).toContain('<span data-line="">a b c</span>');
	});

	it('makes the scroller focusable, and tells Svelte that is deliberate', () => {
		expect(highlight('x', 'ts', null)).toContain(
			'<!-- svelte-ignore a11y_no_noninteractive_tabindex --><pre data-language="ts" tabindex="0">'
		);
	});

	it('marks highlighted lines and numbers them', () => {
		const html = highlight('a\nb\nc', 'js', '{2} showLineNumbers');
		expect(lines(html)).toEqual([
			'<span data-line="">',
			'<span data-line="" data-highlighted-line="">',
			'<span data-line="">'
		]);
		expect(html).toContain('data-line-numbers="" data-line-numbers-max-digits="1"');
	});

	it('gives a blank line its own newline, so it copies back exactly, and drops the trailing one', () => {
		const html = highlight('a\n\nb\n', 'js', null);
		expect(lines(html)).toHaveLength(3);
		expect(html).toContain('<span data-line="">\n</span>');
	});

	it('frames the block with a title and a caption', () => {
		const html = highlight('x', 'ts', 'title="a.ts" caption="Note"');
		expect(html).toMatch(
			/^<figure data-code-figure=""><div data-code-title="">a\.ts<\/div><!-- svelte-ignore \w+ --><pre/
		);
		expect(html).toMatch(/<figcaption data-code-caption="">Note<\/figcaption><\/figure>$/);
	});

	it('falls back to plain text for an unknown or missing language', () => {
		expect(() => highlight('x', 'nosuchlang', null)).not.toThrow();
		expect(highlight('x', 'nosuchlang', null)).toContain('data-language="nosuchlang"');
		expect(highlight('x', null, null)).not.toContain('data-language');
	});

	it('escapes HTML and anything Svelte would read as markup', () => {
		const html = highlight('<a href="{x}">`\\n`</a> & y', null, 'title="<b>{t}</b>"');
		expect(html).not.toMatch(/[{}`]/);
		expect(html).not.toContain('<a href');
		expect(html).not.toContain('<b>');
		expect(html).toContain('&lt;a href=&quot;&#123;x&#125;&quot;&gt;');
		expect(html).toContain('&amp; y');
		expect(html).toContain('&#92;n');
	});
});

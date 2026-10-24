import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { codeThemeCss, TOKEN_CLASS } from './code-theme.js';

describe('code-theme.css', () => {
	it('matches the installed @pierre/highlights palette (run `npm run code-theme`)', () => {
		const file = readFileSync(new URL('./code-theme.css', import.meta.url), 'utf8');
		expect(file).toBe(codeThemeCss());
	});

	it('defines every class the highlighter emits, under both themes', () => {
		const css = codeThemeCss();
		for (const cls of new Set(TOKEN_CLASS.values())) {
			expect(css).toMatch(new RegExp(`^\\[data-code-figure\\] \\.${cls} \\{\\n\\tcolor: #`, 'm'));
			expect(css).toMatch(
				new RegExp(`^\\.dark \\[data-code-figure\\] \\.${cls} \\{\\n\\tcolor: #`, 'm')
			);
		}
		expect(css.match(/--code-foreground: #[0-9a-f]{6};/g)).toHaveLength(2);
	});

	it('shares a class between categories with the same colours', () => {
		expect(new Set(TOKEN_CLASS.values()).size).toBeLessThan(TOKEN_CLASS.size / 2);
		expect(TOKEN_CLASS.get('var(--code-keyword)')).toBe(
			TOKEN_CLASS.get('var(--code-keyword-import)')
		);
	});
});

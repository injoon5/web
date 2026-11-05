import { describe, it, expect } from 'vitest';
import { articlePath, orderLangs, resolveLang } from './article-paths.js';

describe('article URLs', () => {
	it('puts Korean first, so it is the bare URL whenever a post has it', () => {
		expect(orderLangs(['en', 'ko'])).toEqual(['ko', 'en']);
		expect(articlePath('blog', 'x', 'ko', ['ko', 'en'])).toBe('/blog/x');
		expect(articlePath('blog', 'x', 'en', ['ko', 'en'])).toBe('/blog/x/en');
	});

	it('makes English the bare URL of an English-only article', () => {
		expect(articlePath('projects', 'y', 'en', ['en'])).toBe('/projects/y');
	});

	it('falls back to the primary language for one the article lacks', () => {
		expect(resolveLang('en', ['ko'])).toBe('ko');
		expect(resolveLang(undefined, ['ko', 'en'])).toBe('ko');
		expect(resolveLang('en', ['ko', 'en'])).toBe('en');
	});
});

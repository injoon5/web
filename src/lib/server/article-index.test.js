import { describe, it, expect, vi } from 'vitest';

// The real globs compile every post; these cases bring their own metadata.
vi.mock('#lib/server/content-modules.js', () => ({
	metadataGlobs: { blog: { en: {}, ko: {} }, projects: { en: {}, ko: {} } }
}));
import { buildCatalogue } from './catalogue.js';
import { buildArticleIndex } from './article-index.js';
import { pageLang } from './page-lang.js';

const index = buildArticleIndex(
	buildCatalogue({
		blog: {
			en: {
				'/src/content/blog/en/a.md': {
					published: true,
					series: 'S',
					date: '2024-02-01',
					title: 'A'
				},
				'/src/content/blog/en/draft.md': { published: false }
			},
			ko: {
				'/src/content/blog/ko/a.md': {
					published: true,
					series: 'S',
					date: '2024-02-01',
					title: '가'
				},
				'/src/content/blog/ko/b.md': {
					published: true,
					series: 'S',
					date: '2024-01-01',
					title: '나'
				},
				'/src/content/blog/ko/solo.md': { published: true }
			}
		},
		projects: { en: { '/src/content/projects/en/p.md': { published: true } }, ko: {} }
	})
);

describe('buildArticleIndex', () => {
	it('lists the published languages of every article, Korean first', () => {
		expect(index.blog.a.langs).toEqual(['ko', 'en']);
		expect(index.blog.solo.langs).toEqual(['ko']);
		expect(index.blog.draft).toBeUndefined();
		expect(index.projects.p.langs).toEqual(['en']);
	});

	it("carries a post's series in each language, newest first", () => {
		expect(index.blog.a.series?.ko.map((e) => e.title)).toEqual(['가', '나']);
		expect(index.blog.a.series?.en.map((e) => e.title)).toEqual(['A', '나']);
		expect(index.blog.solo.series).toBeUndefined();
	});
});

describe('pageLang', () => {
	it("reads an article's language from its URL", () => {
		expect(pageLang('/blog/a', index)).toBe('ko');
		expect(pageLang('/blog/a/en', index)).toBe('en');
		expect(pageLang('/projects/p', index)).toBe('en');
	});

	it('says Korean for /en on a Korean-only post, which renders Korean', () => {
		expect(pageLang('/blog/solo/en', index)).toBe('ko');
	});

	it('is English for everything else', () => {
		expect(pageLang('/', index)).toBe('en');
		expect(pageLang('/blog', index)).toBe('en');
		expect(pageLang('/blog/missing', index)).toBe('en');
	});
});

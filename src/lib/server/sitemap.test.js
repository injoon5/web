import { describe, it, expect, vi } from 'vitest';

vi.mock('#lib/server/content-modules.js', () => ({
	metadataGlobs: { blog: { en: {}, ko: {} }, projects: { en: {}, ko: {} } }
}));
import { buildCatalogue } from './catalogue.js';
import { toIsoDate, sitemapUrls } from './sitemap.js';

describe('toIsoDate', () => {
	it('normalises a full frontmatter date', () => {
		expect(toIsoDate('2024-05-14')).toBe('2024-05-14');
	});

	it('normalises a bare project year to Jan 1', () => {
		expect(toIsoDate('2025')).toBe('2025-01-01');
	});

	it('returns null for empty or unparseable input', () => {
		expect(toIsoDate('')).toBeNull();
		expect(toIsoDate(null)).toBeNull();
		expect(toIsoDate(undefined)).toBeNull();
		expect(toIsoDate('not a date')).toBeNull();
	});
});

describe('sitemapUrls', () => {
	const urls = sitemapUrls(
		buildCatalogue({
			blog: {
				en: {
					'/src/content/blog/en/us-camp.md': { published: true, date: '2024-07-20' },
					'/src/content/blog/en/draft.md': { published: false, date: '2024-01-01' }
				},
				ko: {
					'/src/content/blog/ko/us-camp.md': { published: true, date: '2024-07-16' },
					'/src/content/blog/ko/film.md': { published: true, date: '2024-03-01' }
				}
			},
			projects: {
				en: {},
				ko: { '/src/content/projects/ko/thing.md': { published: true, year: '2025' } }
			}
		})
	);
	const at = (loc) => urls.find((u) => u.loc === loc);

	it('lists the static pages, then every language of every published article', () => {
		expect(urls.map((u) => u.loc)).toEqual([
			'/',
			'/blog',
			'/projects',
			'/now',
			'/health',
			'/blog/us-camp',
			'/blog/us-camp/en',
			'/blog/film',
			'/projects/thing'
		]);
	});

	it('cross-lists every language of a bilingual article, the primary as x-default', () => {
		const expected = [
			{ hreflang: 'ko', path: '/blog/us-camp' },
			{ hreflang: 'en', path: '/blog/us-camp/en' },
			{ hreflang: 'x-default', path: '/blog/us-camp' }
		];
		expect(at('/blog/us-camp').alternates).toEqual(expected);
		expect(at('/blog/us-camp/en').alternates).toEqual(expected);
	});

	it('gives a single-language article and a static page no alternates', () => {
		expect(at('/blog/film').alternates).toEqual([]);
		expect(at('/now').alternates).toEqual([]);
	});

	it("dates an article by the newest of its languages' dates", () => {
		expect(at('/blog/us-camp').lastmod).toBe('2024-07-20');
		expect(at('/projects/thing').lastmod).toBe('2025-01-01');
	});
});

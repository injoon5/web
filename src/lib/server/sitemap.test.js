import { describe, it, expect } from 'vitest';
import { toIsoDate, contentEntries, sitemapEntries, STATIC_PAGES } from './sitemap.js';

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

describe('contentEntries', () => {
	const enMeta = {
		'/src/content/blog/en/us-camp.md': { published: true, date: '2024-07-16' },
		'/src/content/blog/en/draft.md': { published: false, date: '2024-01-01' }
	};
	const koMeta = {
		'/src/content/blog/ko/us-camp.md': { published: true, date: '2024-07-16' },
		'/src/content/blog/ko/film-photography.md': { published: true, date: '2024-03-01' }
	};

	it('emits one entry per slug, skipping unpublished', () => {
		const entries = contentEntries(enMeta, koMeta, '/blog', 'date');
		expect(entries.map((e) => e.path)).toEqual(['/blog/us-camp', '/blog/film-photography']);
	});

	it('records every language a slug published in, ko first', () => {
		const [usCamp, film] = contentEntries(enMeta, koMeta, '/blog', 'date');
		expect(usCamp.langs).toEqual(['ko', 'en']);
		// A ko-only post lists only ko — no phantom English alternate.
		expect(film.langs).toEqual(['ko']);
	});

	it('sorts newest first and carries an ISO lastmod', () => {
		const entries = contentEntries(enMeta, koMeta, '/blog', 'date');
		expect(entries[0].lastmod).toBe('2024-07-16');
		expect(entries[1].lastmod).toBe('2024-03-01');
	});
});

describe('sitemapEntries', () => {
	it('leads with the static pages, then content', () => {
		const entries = sitemapEntries({
			blogEnMeta: {},
			blogKoMeta: { '/src/content/blog/ko/hello.md': { published: true, date: '2024-01-01' } },
			projectEnMeta: {},
			projectKoMeta: { '/src/content/projects/ko/thing.md': { published: true, year: '2025' } }
		});
		expect(entries.slice(0, STATIC_PAGES.length)).toEqual(STATIC_PAGES);
		expect(entries.map((e) => e.path)).toContain('/blog/hello');
		expect(entries.map((e) => e.path)).toContain('/projects/thing');
	});
});

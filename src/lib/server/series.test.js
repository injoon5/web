import { describe, it, expect, vi } from 'vitest';

vi.mock('#lib/server/content-modules.js', () => ({
	metadataGlobs: { blog: { en: {}, ko: {} }, projects: { en: {}, ko: {} } }
}));
import { buildCatalogue } from './catalogue.js';
import { seriesBySlug } from './series.js';

const { blog } = buildCatalogue({
	blog: {
		en: {
			'/src/content/blog/en/a.md': {
				published: true,
				series: 'Camp',
				date: '2024-01-01',
				title: 'A'
			},
			'/src/content/blog/en/b.md': {
				published: true,
				series: 'Camp',
				date: '2024-03-01',
				title: 'B'
			},
			'/src/content/blog/en/draft.md': { published: false, series: 'Camp', date: '2024-05-01' },
			'/src/content/blog/en/other.md': { published: true, series: 'Other', date: '2024-02-01' },
			'/src/content/blog/en/lone.md': { published: true, date: '2024-02-01' }
		},
		ko: {
			'/src/content/blog/ko/a.md': {
				published: true,
				series: 'Camp',
				date: '2024-01-01',
				title: '가'
			},
			'/src/content/blog/ko/c.md': {
				published: true,
				series: 'Camp',
				date: '2024-02-01',
				title: '다'
			}
		}
	},
	projects: { en: {}, ko: {} }
});
const series = seriesBySlug(blog);

describe('seriesBySlug', () => {
	it('lists the published posts of the series, newest first, in each language', () => {
		expect(series.a.en.map((p) => p.slug)).toEqual(['b', 'c', 'a']);
		expect(series.a.ko.map((p) => p.title)).toEqual(['B', '다', '가']);
	});

	it('falls back to the other language for a post that has only one', () => {
		expect(series.c.en.find((p) => p.slug === 'c')?.title).toBe('다');
	});

	it('cuts each entry down to what the list draws', () => {
		expect(series.a.en[0]).toEqual({ slug: 'b', title: 'B', date: '2024-03-01', series: 'Camp' });
	});

	it('has no key for a post in no series, or an unpublished one', () => {
		expect(Object.keys(series).sort()).toEqual(['a', 'b', 'c', 'other']);
	});
});

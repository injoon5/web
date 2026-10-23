import { describe, it, expect } from 'vitest';
import { postSeries } from './series.js';

const en = {
	'/src/content/blog/en/a.md': { published: true, series: 'Camp', date: '2024-01-01', title: 'A' },
	'/src/content/blog/en/b.md': { published: true, series: 'Camp', date: '2024-03-01', title: 'B' },
	'/src/content/blog/en/draft.md': { published: false, series: 'Camp', date: '2024-05-01' },
	'/src/content/blog/en/other.md': { published: true, series: 'Other', date: '2024-02-01' },
	'/src/content/blog/en/lone.md': { published: true, date: '2024-02-01' }
};
const ko = {
	'/src/content/blog/ko/a.md': { published: true, series: 'Camp', date: '2024-01-01', title: '가' },
	'/src/content/blog/ko/c.md': { published: true, series: 'Camp', date: '2024-02-01', title: '다' }
};

describe('postSeries', () => {
	it('lists the published posts of the series, newest first, in each language', () => {
		const { enSeries, koSeries } = postSeries('a', en, ko);
		expect(enSeries.map((p) => p.slug)).toEqual(['b', 'c', 'a']);
		expect(koSeries.map((p) => p.title)).toEqual(['B', '다', '가']);
	});

	it('falls back to the other language for a post that has only one', () => {
		const { enSeries } = postSeries('c', en, ko);
		expect(enSeries.find((p) => p.slug === 'c')?.title).toBe('다');
	});

	it('is empty for a post in no series, and for one that does not exist', () => {
		expect(postSeries('lone', en, ko)).toEqual({ enSeries: [], koSeries: [] });
		expect(postSeries('nope', en, ko)).toEqual({ enSeries: [], koSeries: [] });
	});
});

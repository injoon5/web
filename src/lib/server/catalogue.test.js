import { describe, it, expect, vi } from 'vitest';

vi.mock('#lib/server/content-modules.js', () => ({
	metadataGlobs: { blog: { en: {}, ko: {} }, projects: { en: {}, ko: {} } }
}));
import { buildCatalogue } from './catalogue.js';
import { listingItem } from './content.js';

const { blog, projects } = buildCatalogue({
	blog: {
		en: {
			'/src/content/blog/en/both.md': { published: true, date: '2024-02-01', title: 'Both' },
			'/src/content/blog/en/en-only.md': { published: true, date: '2024-03-01', title: 'English' },
			'/src/content/blog/en/draft-twin.md': { published: false, title: 'Draft' }
		},
		ko: {
			'/src/content/blog/ko/both.md': { published: true, date: '2024-02-01', title: '둘' },
			'/src/content/blog/ko/draft-twin.md': { published: true, date: '2024-01-01', title: '초안' },
			'/src/content/blog/ko/undated.md': { published: true, title: '날짜 없음' }
		}
	},
	projects: { en: { '/src/content/projects/en/p.md': { published: true, year: '2025' } }, ko: {} }
});

describe('the catalogue', () => {
	it('lists published articles newest first, undated last', () => {
		expect(blog.map((a) => a.slug)).toEqual(['en-only', 'both', 'draft-twin', 'undated']);
		expect(projects.map((a) => a.slug)).toEqual(['p']);
	});

	it('leaves out an unpublished translation', () => {
		expect(blog.find((a) => a.slug === 'draft-twin')?.langs).toEqual(['ko']);
	});
});

describe('listingItem', () => {
	it('shows an article in Korean when it has Korean', () => {
		const both = listingItem(blog.find((a) => a.slug === 'both'));
		expect(both).toMatchObject({ slug: 'both', title: '둘', lang: 'ko', hasEn: true });
	});

	it('has no English twin for a post whose translation is a draft', () => {
		expect(listingItem(blog.find((a) => a.slug === 'draft-twin')).hasEn).toBe(false);
	});
});

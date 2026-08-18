import { describe, it, expect } from 'vitest';
import {
	absolutizeMarkdown,
	healthMarkdown,
	homeMarkdown,
	listingMarkdown,
	nowMarkdown,
	pickArticle,
	withJsonLd,
	yamlFrontmatter
} from './markdown-format.js';

describe('yamlFrontmatter', () => {
	it('omits empty fields', () => {
		expect(yamlFrontmatter({ title: 'Hi', description: '', image: null })).toBe(
			'---\ntitle: Hi\n---\n\n'
		);
	});

	it('quotes values that would break YAML', () => {
		expect(yamlFrontmatter({ title: 'Hello: world' })).toContain('title: "Hello: world"');
	});
});

describe('absolutizeMarkdown', () => {
	it('rewrites root-relative links and leaves the rest', () => {
		const src = '[a](/blog/x) [b](https://ex.com) [c](#top) [d](mailto:me@x.com)';
		expect(absolutizeMarkdown(src, 'https://www.injoon5.com')).toBe(
			'[a](https://www.injoon5.com/blog/x) [b](https://ex.com) [c](#top) [d](mailto:me@x.com)'
		);
	});
});

describe('withJsonLd', () => {
	it('appends a fenced json block', () => {
		expect(withJsonLd('# Hi\n', { '@type': 'WebSite' })).toBe(
			'# Hi\n\n```json\n{\n\t"@type": "WebSite"\n}\n```\n'
		);
	});
});

describe('listingMarkdown', () => {
	it('renders a titled list of links', () => {
		const md = listingMarkdown({
			title: 'Blog',
			description: 'Posts.',
			items: [
				{
					title: 'Hello',
					href: 'https://www.injoon5.com/blog/hello',
					description: 'A post',
					when: '2025-01-01'
				}
			]
		});
		expect(md).toContain('title: Blog');
		expect(md).toContain('# Blog');
		expect(md).toContain('- [Hello](https://www.injoon5.com/blog/hello) — A post (2025-01-01)');
	});
});

describe('homeMarkdown', () => {
	it('includes intro, listings, and JSON-LD', () => {
		const md = homeMarkdown({
			posts: [
				{
					type: ['blog'],
					title: 'A post',
					slug: 'a-post',
					description: 'About a thing',
					date: '2025-02-09',
					coverimage: '',
					tags: [],
					published: true
				}
			],
			projects: [
				{
					title: 'A project',
					slug: 'a-project',
					description: 'Did a thing',
					year: '2025',
					tags: [],
					coverimage: '',
					published: true
				}
			]
		});
		expect(md).toContain('# Injoon Oh');
		expect(md).toContain('/blog/a-post');
		expect(md).toContain('/projects/a-project');
		expect(md).toContain('"@type": "WebSite"');
		expect(md.startsWith('---\n')).toBe(true);
	});
});

describe('nowMarkdown / healthMarkdown', () => {
	it('emits titled documents', () => {
		expect(nowMarkdown()).toContain('# Now');
		expect(healthMarkdown()).toContain('# Health');
		expect(healthMarkdown()).toMatch(/- Steps/);
	});
});

describe('pickArticle', () => {
	const rawEn = { '/src/content/blog/en/us-camp.md': '# EN' };
	const rawKo = { '/src/content/blog/ko/us-camp.md': '# KO' };
	const metaEn = { '/src/content/blog/en/us-camp.md': { published: true, title: 'EN' } };
	const metaKo = { '/src/content/blog/ko/us-camp.md': { published: true, title: 'KO' } };

	it('defaults to Korean', () => {
		expect(pickArticle(rawEn, rawKo, metaEn, metaKo, 'blog', 'us-camp', null)?.lang).toBe('ko');
		expect(pickArticle(rawEn, rawKo, metaEn, metaKo, 'blog', 'us-camp', null)?.raw).toBe('# KO');
	});

	it('selects English when asked', () => {
		expect(pickArticle(rawEn, rawKo, metaEn, metaKo, 'blog', 'us-camp', 'en')?.lang).toBe('en');
	});

	it('falls back when the preferred twin is unpublished', () => {
		const unpublishedEn = { '/src/content/blog/en/us-camp.md': { published: false, title: 'EN' } };
		expect(pickArticle(rawEn, rawKo, unpublishedEn, metaKo, 'blog', 'us-camp', 'en')?.lang).toBe(
			'ko'
		);
	});

	it('returns null for unpublished / missing slugs', () => {
		expect(pickArticle({}, {}, {}, {}, 'blog', 'nope', null)).toBeNull();
		expect(
			pickArticle(
				rawEn,
				rawKo,
				{ '/src/content/blog/en/us-camp.md': { published: false } },
				{},
				'blog',
				'us-camp',
				null
			)
		).toBeNull();
	});
});

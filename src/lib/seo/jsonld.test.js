import { describe, it, expect } from 'vitest';
import {
	keywordsFor,
	blogPostingSchema,
	projectSchema,
	breadcrumbSchema,
	homeSchema,
	jsonLdScript,
	AUTHOR_NAME_KO
} from './jsonld.js';

describe('keywordsFor', () => {
	it('leads with both author names', () => {
		expect(keywordsFor()).toEqual(['오인준', 'Injoon Oh']);
	});

	it('appends page terms, de-duplicated and trimmed, blanks dropped', () => {
		expect(keywordsFor(['  US Camp  ', '', null, 'Injoon Oh', 'LG AI Youth Camp'])).toEqual([
			'오인준',
			'Injoon Oh',
			'US Camp',
			'LG AI Youth Camp'
		]);
	});
});

describe('blogPostingSchema', () => {
	it('carries the Korean name via author.alternateName', () => {
		const schema = blogPostingSchema({ title: 'US Camp', url: 'https://x/1' });
		expect(schema['@type']).toBe('BlogPosting');
		expect(schema.author.alternateName).toBe(AUTHOR_NAME_KO);
	});

	it('omits empty optional fields', () => {
		const schema = blogPostingSchema({ title: 'US Camp', url: 'https://x/1' });
		expect(schema).not.toHaveProperty('description');
		expect(schema).not.toHaveProperty('keywords');
		expect(schema).not.toHaveProperty('image');
	});

	it('keeps keywords and section when present', () => {
		const schema = blogPostingSchema({
			title: 'US Camp',
			url: 'https://x/1',
			keywords: ['오인준', 'US Camp'],
			section: 'LG AI Youth Camp'
		});
		expect(schema.keywords).toEqual(['오인준', 'US Camp']);
		expect(schema.articleSection).toBe('LG AI Youth Camp');
	});
});

describe('projectSchema', () => {
	it('is a CreativeWork with the author attached', () => {
		const schema = projectSchema({ title: 'Sirius', url: 'https://x/p', year: '2025' });
		expect(schema['@type']).toBe('CreativeWork');
		expect(schema.dateCreated).toBe('2025');
		expect(schema.author.name).toBe('Injoon Oh');
	});
});

describe('breadcrumbSchema', () => {
	it('numbers items from 1 in trail order', () => {
		const schema = breadcrumbSchema([
			{ name: 'Injoon Oh', url: 'https://x/' },
			{ name: 'Blog', url: 'https://x/blog' }
		]);
		expect(schema.itemListElement.map((i) => i.position)).toEqual([1, 2]);
		expect(schema.itemListElement[1].name).toBe('Blog');
	});
});

describe('homeSchema', () => {
	it('exposes 오인준 on the WebSite alternateName', () => {
		const graph = homeSchema()['@graph'];
		const site = graph.find((n) => n['@type'] === 'WebSite');
		expect(site.alternateName).toBe('오인준');
	});
});

describe('jsonLdScript', () => {
	it('escapes < so a value cannot break out of the script tag', () => {
		const html = jsonLdScript({ x: '</script><script>alert(1)' });
		expect(html).not.toContain('</script><script>');
		expect(html).toContain('\\u003c/script>');
	});
});

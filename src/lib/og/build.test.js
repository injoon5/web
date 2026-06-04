import { describe, it, expect } from 'vitest';
import { resolveOgInput, buildOgElement } from './build';

const params = (obj) => new URLSearchParams(obj);

describe('resolveOgInput', () => {
	it('returns a fixture copy when fixture id is known', () => {
		const input = resolveOgInput(params({ fixture: 'home' }));
		expect(input.template).toBe('home');
	});

	it('ignores an unknown fixture and reads params instead', () => {
		const input = resolveOgInput(params({ fixture: 'does-not-exist', template: 'blog' }));
		expect(input.template).toBe('blog');
	});

	it('defaults to the home template with empty fields', () => {
		const input = resolveOgInput(params({}));
		expect(input).toEqual({
			template: 'home',
			title: '',
			description: '',
			date: '',
			year: '',
			tags: []
		});
	});

	it('clamps title/description/date/year to 200 chars', () => {
		const long = 'x'.repeat(500);
		const input = resolveOgInput(
			params({ title: long, description: long, date: long, year: long })
		);
		expect(input.title).toHaveLength(200);
		expect(input.description).toHaveLength(200);
		expect(input.date).toHaveLength(200);
		expect(input.year).toHaveLength(200);
	});

	it('splits, trims and filters tags', () => {
		expect(resolveOgInput(params({ tags: 'a, b ,,c' })).tags).toEqual(['a', 'b', 'c']);
	});

	it('caps the number of tags at 8', () => {
		const tags = Array.from({ length: 20 }, (_, i) => `t${i}`).join(',');
		expect(resolveOgInput(params({ tags })).tags).toHaveLength(8);
	});

	it('caps each tag length at 40 chars', () => {
		expect(resolveOgInput(params({ tags: 'y'.repeat(100) })).tags[0]).toHaveLength(40);
	});

	it('returns an empty tag array when none provided', () => {
		expect(resolveOgInput(params({})).tags).toEqual([]);
	});
});

describe('buildOgElement', () => {
	it.each(['home', 'blog', 'blog-post', 'projects', 'project', 'now'])(
		'returns a satori element tree for the %s template',
		(template) => {
			const el = buildOgElement({ template, title: 't', description: 'd', tags: ['x'] });
			expect(el).toBeTypeOf('object');
			expect(el).toHaveProperty('type');
		}
	);

	it('falls back to the home template for an unknown template', () => {
		expect(buildOgElement({ template: 'bogus' })).toEqual(buildOgElement({ template: 'home' }));
	});
});

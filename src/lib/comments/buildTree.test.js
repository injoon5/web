import { describe, it, expect } from 'vitest';
import { buildTree } from './buildTree';

const c = (id, parentId, createdAt) => ({ id, parentId, createdAt, text: `c${id}` });

describe('buildTree', () => {
	it('returns an empty array for no comments', () => {
		expect(buildTree([])).toEqual([]);
	});

	it('keeps parentless comments as roots in input order', () => {
		const roots = buildTree([c('a', null, 1), c('b', null, 2)]);
		expect(roots.map((r) => r.id)).toEqual(['a', 'b']);
		expect(roots.every((r) => Array.isArray(r.children) && r.children.length === 0)).toBe(true);
	});

	it('nests replies under their parent', () => {
		const roots = buildTree([c('p', null, 1), c('child', 'p', 2)]);
		expect(roots).toHaveLength(1);
		expect(roots[0].children.map((n) => n.id)).toEqual(['child']);
	});

	it('supports multi-level nesting', () => {
		const roots = buildTree([c('p', null, 1), c('child', 'p', 2), c('grand', 'child', 3)]);
		expect(roots[0].children[0].children.map((n) => n.id)).toEqual(['grand']);
	});

	it('sorts replies chronologically regardless of input order', () => {
		const roots = buildTree([c('p', null, 1), c('late', 'p', 30), c('early', 'p', 10)]);
		expect(roots[0].children.map((n) => n.id)).toEqual(['early', 'late']);
	});

	it('surfaces a comment whose parent is missing as a stray root', () => {
		const roots = buildTree([c('orphan', 'gone', 5)]);
		expect(roots).toHaveLength(1);
		expect(roots[0].id).toBe('orphan');
		expect(roots[0].stray).toBe(true);
	});

	it('does not mark genuine roots as stray', () => {
		const roots = buildTree([c('a', null, 1)]);
		expect(roots[0].stray).toBeUndefined();
	});

	it('does not mutate the input objects', () => {
		const input = [c('a', null, 1)];
		buildTree(input);
		expect('children' in input[0]).toBe(false);
	});
});

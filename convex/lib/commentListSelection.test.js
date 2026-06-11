import { describe, it, expect } from 'vitest';
import { selectTopWithAncestors } from './commentListSelection.js';

const score = (doc) => (doc.upvotes ?? 0) - (doc.downvotes ?? 0);

const doc = (id, parentId, upvotes, createdAt = 0) => ({
	_id: id,
	parentId,
	upvotes,
	downvotes: 0,
	_creationTime: createdAt
});

describe('selectTopWithAncestors', () => {
	it('includes a low-score parent when a high-score child is selected', () => {
		const parent = doc('p', null, 1, 1);
		const child = doc('c', 'p', 50, 2);
		const other = doc('o', null, 40, 3);

		const result = selectTopWithAncestors([parent, child, other], 2, score);
		const ids = result.map((d) => d._id);

		expect(ids).toContain('p');
		expect(ids).toContain('c');
	});

	it('does not exceed maxComments when ancestors are pulled in', () => {
		const roots = Array.from({ length: 5 }, (_, i) => doc(`r${i}`, null, 10 - i, i));
		const reply = doc('reply', 'r0', 100, 10);

		const result = selectTopWithAncestors([...roots, reply], 3, score);
		expect(result.length).toBeLessThanOrEqual(3);
	});
});

import { describe, it, expect } from 'vitest';
import { formatRelative } from './format.js';

describe('formatRelative', () => {
	const now = Date.parse('2026-08-02T12:00:00Z');

	it('reads in the largest unit that fits', () => {
		expect(formatRelative(now - 3 * 60 * 60 * 1000, now)).toBe('3 hours ago');
		expect(formatRelative(now - 2 * 24 * 60 * 60 * 1000, now)).toBe('2 days ago');
		expect(formatRelative(new Date(now - 120 * 1000), now)).toBe('2 minutes ago');
	});

	it('says just now inside the first minute', () => {
		expect(formatRelative(now - 5000, now)).toBe('just now');
	});
});

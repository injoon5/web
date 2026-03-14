import { describe, it, expect } from 'vitest';
import { formatDate, sliceText } from './utils.js';

// ─── formatDate ──────────────────────────────────────────────────────────────

describe('formatDate', () => {
	it('formats a date string with default (medium) style in English', () => {
		// The function replaces dashes with slashes to satisfy Safari
		const result = formatDate('2024-01-15');
		// Intl.DateTimeFormat output depends on the locale; in 'en' medium = "Jan 15, 2024"
		expect(result).toMatch(/Jan(uary)?\s*\.?\s*15,?\s*2024/i);
	});

	it('formats with "long" style', () => {
		const result = formatDate('2024-06-01', 'long', 'en');
		expect(result).toContain('2024');
		expect(result).toMatch(/June/i);
	});

	it('formats with "short" style', () => {
		const result = formatDate('2024-06-01', 'short', 'en');
		// short style: e.g. "6/1/24"
		expect(result).toMatch(/6.+24/);
	});

	it('handles dates written with dashes (Safari workaround)', () => {
		// Should not throw; the function replaces "-" with "/" internally
		expect(() => formatDate('2023-12-25')).not.toThrow();
	});
});

// ─── sliceText ───────────────────────────────────────────────────────────────

describe('sliceText', () => {
	it('returns the full text when word count is below the limit', () => {
		const text = 'hello world';
		expect(sliceText(text, 5)).toBe('hello world');
	});

	it('returns the full text when word count equals the limit', () => {
		const text = 'one two three';
		expect(sliceText(text, 3)).toBe('one two three');
	});

	it('truncates and appends "..." when word count exceeds the limit', () => {
		const text = 'one two three four five';
		expect(sliceText(text, 3)).toBe('one two three...');
	});

	it('truncates to a single word', () => {
		expect(sliceText('alpha beta gamma', 1)).toBe('alpha...');
	});

	it('handles a single-word text under the limit', () => {
		expect(sliceText('hello', 10)).toBe('hello');
	});

	it('handles an empty string', () => {
		// split(' ') on '' gives [''], which has length 1
		expect(sliceText('', 5)).toBe('');
	});

	it('handles limit of 0', () => {
		// All words exceed 0-word limit → slice(0, 0) = '' → '...'
		expect(sliceText('hello world', 0)).toBe('...');
	});
});

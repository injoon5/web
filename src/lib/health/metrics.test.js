import { describe, it, expect } from 'vitest';
import {
	PAGE_METRICS,
	dayScore,
	formatRelative,
	formatValue,
	isolatedPoints,
	lastFilledIndex,
	latestIndex,
	rangeStartDate,
	scoreLabel,
	valueDomain
} from './metrics.js';

const section = (key, values) => ({
	metric: PAGE_METRICS.find((m) => m.key === key),
	series: { values }
});

describe('rangeStartDate', () => {
	it('reaches back from the end of the window, inclusive', () => {
		expect(rangeStartDate('2026-08-02', 7)).toBe('2026-07-27');
		expect(rangeStartDate('2026-08-02', 1)).toBe('2026-08-02');
	});
});

/**
 * A stroke needs two points. Without a dot, one day of data draws an empty box —
 * which is exactly what someone who just set the Shortcut up would see.
 */
describe('isolatedPoints', () => {
	it('marks a lone reading in an otherwise empty window', () => {
		expect(isolatedPoints([null, null, 8421, null])).toEqual([{ i: 2, value: 8421 }]);
	});

	it('marks a reading stranded between gaps', () => {
		expect(isolatedPoints([10, null, 20, null, 30])).toEqual([
			{ i: 0, value: 10 },
			{ i: 2, value: 20 },
			{ i: 4, value: 30 }
		]);
	});

	it('leaves a reading alone when a neighbour can carry the line', () => {
		expect(isolatedPoints([10, 20, null, 40, 50])).toEqual([]);
	});

	it('returns nothing for an empty series', () => {
		expect(isolatedPoints([null, null])).toEqual([]);
	});
});

describe('valueDomain', () => {
	it('gives a flat series a band to sit in', () => {
		const [min, max] = valueDomain([50, 50, 50]);
		expect(min).toBeLessThan(50);
		expect(max).toBeGreaterThan(50);
	});

	it('falls back to a unit domain when nothing reported', () => {
		expect(valueDomain([null, null])).toEqual([0, 1]);
	});
});

describe('lastFilledIndex / latestIndex', () => {
	it('finds the newest reading, ignoring trailing gaps', () => {
		expect(lastFilledIndex([1, null, 3, null])).toBe(2);
		expect(lastFilledIndex([null, null])).toBe(-1);
	});

	it('takes the newest day any metric reported', () => {
		const sections = [section('steps', [1, 2, null]), section('sleepHours', [7, null, null])];
		expect(latestIndex(sections)).toBe(1);
		expect(latestIndex([])).toBe(-1);
	});
});

describe('dayScore', () => {
	it('averages each metric against its goal', () => {
		// Half the step goal and the full sleep goal average to 75.
		const sections = [section('steps', [5000]), section('sleepHours', [8])];
		expect(dayScore(sections, 0)).toEqual({ score: 75, counted: 2, of: 2 });
	});

	it('caps a metric at its goal so one number cannot carry the day', () => {
		const sections = [section('steps', [40000]), section('sleepHours', [4])];
		expect(dayScore(sections, 0).score).toBe(75);
	});

	// A metric that has not synced yet must not read as a zero — it drops out of
	// the average, and `counted` says the day was scored on less.
	it('scores only what reported', () => {
		const sections = [section('steps', [10000]), section('sleepHours', [null])];
		expect(dayScore(sections, 0)).toEqual({ score: 100, counted: 1, of: 2 });
	});

	it('has no score for a day with nothing in it', () => {
		const sections = [section('steps', [null]), section('sleepHours', [null])];
		expect(dayScore(sections, 0)).toEqual({ score: null, counted: 0, of: 2 });
		expect(dayScore(sections, -1).score).toBeNull();
	});
});

describe('scoreLabel', () => {
	it('bands a score into a word', () => {
		expect(scoreLabel(92)).toBe('Excellent');
		expect(scoreLabel(70)).toBe('Good');
		expect(scoreLabel(50)).toBe('Fair');
		expect(scoreLabel(10)).toBe('Light');
		expect(scoreLabel(null)).toBe('No data');
	});
});

describe('formatValue', () => {
	it('dashes a gap rather than printing a zero', () => {
		expect(formatValue(null)).toBe('—');
		expect(formatValue(undefined, 1)).toBe('—');
	});

	it('groups thousands and honours decimals', () => {
		expect(formatValue(8421)).toBe('8,421');
		expect(formatValue(6.23, 1)).toBe('6.2');
	});
});

describe('formatRelative', () => {
	const now = Date.parse('2026-08-02T12:00:00Z');

	it('reads in the largest unit that fits', () => {
		expect(formatRelative(now - 3 * 60 * 60 * 1000, now)).toBe('3 hours ago');
		expect(formatRelative(now - 2 * 24 * 60 * 60 * 1000, now)).toBe('2 days ago');
	});

	it('says just now inside the first minute', () => {
		expect(formatRelative(now - 5000, now)).toBe('just now');
	});
});

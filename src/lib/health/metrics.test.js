import { describe, it, expect } from 'vitest';
import {
	PAGE_METRICS,
	dayScore,
	formatCompact,
	formatRelative,
	formatValue,
	lastFilledIndex,
	latestIndex,
	rangeStartDate,
	scoreLabel,
	scoreTone,
	valueAt,
	valueDomain,
	zeroFilled
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
 * A day inside the tracked window that reported nothing is a day of zero — a
 * rest day, not an outage. Past the newest reading there is nothing to say yet,
 * so the line stops rather than diving to the floor on the right-hand edge.
 */
describe('zeroFilled', () => {
	it('reads a gap between readings as the zero it is', () => {
		expect(zeroFilled([10, null, 30])).toEqual([10, 0, 30]);
	});

	it('cuts everything after the newest reading', () => {
		expect(zeroFilled([10, 20, null, null])).toEqual([10, 20]);
	});

	it('carries a lone reading, leading gaps and all', () => {
		expect(zeroFilled([null, null, 8421, null])).toEqual([0, 0, 8421]);
	});

	it('has nothing to draw for an empty window', () => {
		expect(zeroFilled([null, null])).toEqual([]);
	});
});

describe('valueAt', () => {
	it('reports a gap inside the window as zero', () => {
		expect(valueAt([10, null, 30], 1)).toBe(0);
	});

	it('reports nothing past the newest reading', () => {
		expect(valueAt([10, 20, null], 2)).toBeNull();
		expect(valueAt([10, 20, null], -1)).toBeNull();
		expect(valueAt([null, null], 0)).toBeNull();
	});
});

describe('valueDomain', () => {
	it('gives a flat series a band to sit in', () => {
		const [min, max] = valueDomain([50, 50, 50]);
		expect(min).toBeLessThan(50);
		expect(max).toBeGreaterThan(50);
	});

	// None of these metrics goes below zero, so the floor stops there — the axis
	// gets to label the bottom of the box with a number that means something.
	it('floors at zero rather than padding into negatives', () => {
		expect(valueDomain([0, 5000, 10000])[0]).toBe(0);
		// A flat series still gets its band, clipped at the floor.
		expect(valueDomain([0.5, 0.5, 0.5])[0]).toBe(0);
	});

	it('falls back to a unit domain when nothing reported', () => {
		expect(valueDomain([null, null])).toEqual([0, 1]);
	});
});

describe('formatCompact', () => {
	it('keeps an axis label short enough for the gutter', () => {
		expect(formatCompact(12000)).toBe('12k');
		expect(formatCompact(1200)).toBe('1.2k');
		expect(formatCompact(2000)).toBe('2k');
		expect(formatCompact(430)).toBe('430');
		expect(formatCompact(6.2, 1)).toBe('6.2');
		expect(formatCompact(0)).toBe('0');
	});
});

describe('lastFilledIndex / latestIndex', () => {
	it('finds the newest reading, ignoring trailing gaps', () => {
		expect(lastFilledIndex([1, null, 3, null])).toBe(2);
		expect(lastFilledIndex([null, null])).toBe(-1);
	});

	it('takes the newest day any metric reported', () => {
		const sections = [section('steps', [1, 2, null]), section('exerciseMinutes', [7, null, null])];
		expect(latestIndex(sections)).toBe(1);
		expect(latestIndex([])).toBe(-1);
	});
});

describe('dayScore', () => {
	it('averages each metric against its goal', () => {
		// Half the step goal and the full exercise goal average to 75.
		const sections = [section('steps', [5000]), section('exerciseMinutes', [30])];
		expect(dayScore(sections, 0)).toEqual({ score: 75, counted: 2, of: 2 });
	});

	it('caps a metric at its goal so one number cannot carry the day', () => {
		const sections = [section('steps', [40000]), section('exerciseMinutes', [15])];
		expect(dayScore(sections, 0).score).toBe(75);
	});

	// The charts draw a gap as the zero it is, but the score does not average it
	// in: a Watch on the charger and a day in bed produce the same zero, and only
	// one of them has earned a worse ring.
	it('ignores a zero rather than averaging it in', () => {
		const sections = [section('steps', [10000, 10000]), section('exerciseMinutes', [null, 30])];
		expect(dayScore(sections, 0)).toEqual({ score: 100, counted: 1, of: 2 });
	});

	// Same rule for a stored zero as for a gap — the value is what matters, not
	// whether a row happens to exist for it.
	it('ignores a zero that was actually reported', () => {
		const sections = [section('steps', [10000]), section('exerciseMinutes', [0])];
		expect(dayScore(sections, 0)).toEqual({ score: 100, counted: 1, of: 2 });
	});

	// A metric whose newest reading is older than the day being scored has
	// nothing to say yet, so it drops out and `counted` reports the shortfall.
	it('drops a metric that has not synced this far forward', () => {
		const sections = [section('steps', [10000, 10000]), section('exerciseMinutes', [30, null])];
		expect(dayScore(sections, 1)).toEqual({ score: 100, counted: 1, of: 2 });
	});

	it('has no score for a day with nothing in it', () => {
		const sections = [section('steps', [null]), section('exerciseMinutes', [null])];
		expect(dayScore(sections, 0)).toEqual({ score: null, counted: 0, of: 2 });
		expect(dayScore(sections, -1).score).toBeNull();
	});

	// Every metric zero is the same as every metric missing, as far as the ring
	// is concerned: there is nothing left to average, so the dial says so.
	it('has no score for a day that is all zeros', () => {
		const sections = [section('steps', [0]), section('exerciseMinutes', [0])];
		expect(dayScore(sections, 0)).toEqual({ score: null, counted: 0, of: 2 });
	});
});

describe('scoreLabel / scoreTone', () => {
	it('bands a score into a word', () => {
		expect(scoreLabel(92)).toBe('Excellent');
		expect(scoreLabel(70)).toBe('Good');
		expect(scoreLabel(50)).toBe('Fair');
		expect(scoreLabel(10)).toBe('Light');
		expect(scoreLabel(null)).toBe('No data');
	});

	// The word and the ring read off one list of thresholds, so they can never
	// disagree about which band a score is in.
	it('bands a score into a ring color on the same thresholds', () => {
		expect(scoreTone(92)).toBe('var(--score-excellent)');
		expect(scoreTone(85)).toBe('var(--score-excellent)');
		expect(scoreTone(84)).toBe('var(--score-good)');
		expect(scoreTone(50)).toBe('var(--score-fair)');
		expect(scoreTone(10)).toBe('var(--score-light)');
		expect(scoreTone(null)).toBe('var(--score-none)');
	});
});

describe('formatValue', () => {
	it('dashes a value the window has nothing for', () => {
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

/**
 * The shapes real Apple Health data actually arrives in.
 *
 * A step count is not a smooth series: a marathon Saturday sits next to a sick
 * Sunday, the Watch stops syncing for a week, the Shortcut's hourly automation
 * misses a run and then catches up. Each of these used to break something —
 * a domain that collapsed, a spike that flattened its own baseline, a gap that
 * cut the line in half — so they are pinned here rather than left to a
 * screenshot.
 */
describe('awkward real-world series', () => {
	/** Every value the chart plots has to be a finite number inside the domain. */
	const plottable = (values, headroom = 0.12) => {
		const filled = zeroFilled(values);
		const [lo, hi] = valueDomain(filled, headroom);

		expect(Number.isFinite(lo)).toBe(true);
		expect(Number.isFinite(hi)).toBe(true);
		expect(hi).toBeGreaterThan(lo);
		for (const value of filled) {
			expect(Number.isFinite(value)).toBe(true);
			expect(value).toBeGreaterThanOrEqual(lo);
			expect(value).toBeLessThanOrEqual(hi);
		}
		return { filled, lo, hi };
	};

	// Four orders of magnitude inside one window. The domain has to hold the
	// whole range rather than clipping the top off the biggest day.
	it('holds wild volatility inside the domain', () => {
		const wild = [12, 41000, 3, 28000, 0, 39500, 7, 500, 44000, 1];
		const { hi } = plottable(wild);
		expect(hi).toBeGreaterThanOrEqual(44000);
	});

	// A zig-zag reverses direction on every point. Nothing here smooths it, and
	// nothing should drop a point for being a local extreme.
	it('keeps every point through sharp direction changes', () => {
		const zigzag = [0, 20000, 0, 20000, 0, 20000, 0];
		const { filled } = plottable(zigzag);
		expect(filled).toEqual(zigzag);
	});

	// A single 30km day on a week of nothing. The old padded domain read the
	// spike as the whole range; the floor at zero keeps the flat days on the
	// baseline where they belong rather than floating mid-box.
	it('keeps a flat baseline flat under an isolated spike', () => {
		const spike = [0, 0, 0, 0, 31000, 0, 0, 0];
		const { lo, hi } = plottable(spike);
		expect(lo).toBe(0);
		expect(hi).toBeGreaterThanOrEqual(31000);
	});

	// The same shape on a baseline that is not zero: a resting series with one
	// outlier still has to leave the baseline distinguishable from the floor.
	it('leaves room under a spike over a non-zero baseline', () => {
		const spike = [5200, 5100, 5300, 48000, 5150, 5250];
		const { lo, hi } = plottable(spike);
		expect(lo).toBeGreaterThanOrEqual(0);
		expect(lo).toBeLessThan(5100);
		expect(hi).toBeGreaterThanOrEqual(48000);
	});

	// The Watch syncs when it feels like it. Gaps land anywhere except the tail,
	// and every one of them is a zero the chart draws through.
	it('draws through random gaps without breaking the line', () => {
		const irregular = [8000, null, null, 12000, null, 3000, null, null, null, 9000];
		const { filled } = plottable(irregular);

		expect(filled).toHaveLength(10);
		expect(filled).toEqual([8000, 0, 0, 12000, 0, 3000, 0, 0, 0, 9000]);
	});

	// Trailing gaps are the one kind that is not a zero: the metric has not
	// synced that far forward, so the line stops instead of falling off a cliff.
	it('stops rather than diving when the tail has not synced', () => {
		const values = [8000, 9000, 7000, null, null, null];
		const { filled } = plottable(values);

		expect(filled).toHaveLength(3);
		expect(valueAt(values, 3)).toBeNull();
		expect(valueAt(values, 2)).toBe(7000);
	});

	// Nothing but gaps around one reading, on the very first slot: the one shape
	// with no second point to stroke toward.
	it('survives a window holding a single first-slot reading', () => {
		const { filled, lo, hi } = plottable([4200, null, null, null]);
		expect(filled).toEqual([4200]);
		expect(lo).toBeLessThan(4200);
		expect(hi).toBeGreaterThan(4200);
	});

	// A window of nothing but zeros is flat *on* the floor — the degenerate case
	// where min, max and the floor are all the same number.
	it('gives an all-zero window a band to sit in', () => {
		const { lo, hi } = plottable([0, 0, 0, 0]);
		expect(lo).toBe(0);
		expect(hi).toBeGreaterThan(0);
	});

	// Headroom is tunable through the dials panel, including all the way to zero.
	// At zero the top of the domain sits exactly on the highest reading, which
	// still has to be a valid domain rather than a collapsed one.
	it('stays valid with headroom tuned out entirely', () => {
		const { hi } = plottable([0, 15000, 3000, 22000], 0);
		expect(hi).toBe(22000);
	});

	/**
	 * The score has to survive the same shapes. A spike caps at its goal, a gap
	 * scores zero, and a day past a metric's newest reading drops out — no shape
	 * should produce a NaN in the ring.
	 */
	it('scores every one of those shapes without a NaN', () => {
		const sections = [
			section('steps', [0, 41000, null, 12000, null]),
			section('exerciseMinutes', [null, 120, 0, null, null])
		];

		for (let i = 0; i < 5; i++) {
			const { score, counted, of } = dayScore(sections, i);
			expect(score === null || Number.isFinite(score)).toBe(true);
			if (score !== null) {
				expect(score).toBeGreaterThanOrEqual(0);
				expect(score).toBeLessThanOrEqual(100);
			}
			expect(counted).toBeLessThanOrEqual(of);
		}

		// A 41k-step, 120-minute day is capped at both goals rather than
		// overflowing past 100.
		expect(dayScore(sections, 1).score).toBe(100);
		// Day 0 is a zero on steps and a gap on exercise — nothing to average.
		expect(dayScore(sections, 0)).toEqual({ score: null, counted: 0, of: 2 });
		// Day 2 is a gap on steps and a reported zero on exercise. Same answer:
		// the two are indistinguishable, so neither is scored.
		expect(dayScore(sections, 2)).toEqual({ score: null, counted: 0, of: 2 });
		// Day 4 is past both metrics' newest readings, so there is nothing to score.
		expect(dayScore(sections, 4).score).toBeNull();
	});
});

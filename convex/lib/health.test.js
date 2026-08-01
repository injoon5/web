import { describe, expect, it } from 'vitest';
import {
	DAY_MS,
	HOUR_MS,
	applyBucketDelta,
	bucketSizeFor,
	buildDailySeries,
	buildHourlySeries,
	dateKey,
	dateKeyDiff,
	dateKeyToMs,
	foldSamples,
	hourFloor,
	isDateKey,
	mergeValues,
	metricKind,
	metricUnit,
	parseInstant,
	shiftDateKey,
	workoutExternalId
} from './health.js';

describe('metric semantics', () => {
	it('treats totals as sums and readings as averages', () => {
		expect(metricKind('steps')).toBe('sum');
		expect(metricKind('activeEnergy')).toBe('sum');
		expect(metricKind('heartRate')).toBe('avg');
		expect(metricKind('restingHeartRate')).toBe('avg');
	});

	it('falls back to averaging an unknown metric', () => {
		expect(metricKind('somethingNew')).toBe('avg');
		expect(metricUnit('somethingNew')).toBe('');
	});
});

describe('date keys', () => {
	it('round-trips through epoch ms', () => {
		expect(dateKey(dateKeyToMs('2026-08-01'))).toBe('2026-08-01');
	});

	it('shifts across month and year boundaries', () => {
		expect(shiftDateKey('2026-08-01', -1)).toBe('2026-07-31');
		expect(shiftDateKey('2025-12-31', 1)).toBe('2026-01-01');
		expect(dateKeyDiff('2026-07-25', '2026-08-01')).toBe(7);
	});

	it('rejects impossible dates that still match the shape', () => {
		expect(isDateKey('2026-08-01')).toBe(true);
		expect(isDateKey('2026-02-31')).toBe(false);
		expect(isDateKey('2026-8-1')).toBe(false);
		expect(isDateKey(20260801)).toBe(false);
	});

	it('accepts ISO strings and epoch ms as instants', () => {
		expect(parseInstant('2026-08-01T09:14:00Z')).toBe(Date.parse('2026-08-01T09:14:00Z'));
		expect(parseInstant(1754040840000)).toBe(1754040840000);
		expect(parseInstant('not a date')).toBe(null);
		expect(parseInstant(null)).toBe(null);
	});

	it('floors to the hour', () => {
		const t = Date.parse('2026-08-01T09:14:37.500Z');
		expect(hourFloor(t)).toBe(Date.parse('2026-08-01T09:00:00Z'));
		expect(hourFloor(t) % HOUR_MS).toBe(0);
	});
});

describe('foldSamples', () => {
	const samples = (n, from = Date.parse('2026-08-01T09:00:00Z')) =>
		Array.from({ length: n }, (_, i) => ({ time: from + i * 1000, value: 60 + (i % 10) }));

	it('folds a fresh batch once', () => {
		const { inserts, delta } = foldSamples([], samples(100));
		expect(inserts).toHaveLength(100);
		expect(delta.count).toBe(100);
		expect(delta.min).toBe(60);
		expect(delta.max).toBe(69);
	});

	// The failure mode this whole tier exists to avoid: a sample counted into a
	// bucket sum twice can never be backed out, so the chart is wrong forever.
	it('is a no-op when the same batch arrives twice', () => {
		const batch = samples(100);
		const first = foldSamples([], batch);
		const bucket = applyBucketDelta(null, first.delta);
		expect(bucket.count).toBe(100);

		const second = foldSamples(
			first.inserts.map((s) => s.time),
			batch
		);
		expect(second.inserts).toHaveLength(0);
		expect(second.delta).toBe(null);

		// Nothing new, so the bucket is untouched.
		expect(bucket.count).toBe(100);
	});

	it('deduplicates repeats inside a single batch', () => {
		const batch = samples(3);
		const { inserts } = foldSamples([], [...batch, ...batch]);
		expect(inserts).toHaveLength(3);
	});

	it('folds only the genuinely new samples of an overlapping batch', () => {
		const batch = samples(100);
		const first = foldSamples([], batch.slice(0, 60));
		let bucket = applyBucketDelta(null, first.delta);

		const second = foldSamples(
			batch.slice(0, 60).map((s) => s.time),
			batch
		);
		expect(second.inserts).toHaveLength(40);
		bucket = applyBucketDelta(bucket, second.delta);

		expect(bucket.count).toBe(100);
		expect(bucket.sum).toBe(batch.reduce((total, s) => total + s.value, 0));
	});
});

describe('applyBucketDelta', () => {
	it('widens the range band rather than replacing it', () => {
		const bucket = applyBucketDelta(null, { count: 2, sum: 130, min: 60, max: 70 });
		const merged = applyBucketDelta(bucket, { count: 1, sum: 90, min: 90, max: 90 });
		expect(merged).toEqual({ count: 3, sum: 220, min: 60, max: 90 });
	});
});

describe('bucketSizeFor', () => {
	it('stays daily inside the point budget', () => {
		expect(bucketSizeFor(365, 400)).toBe(1);
		expect(bucketSizeFor(400, 400)).toBe(1);
	});

	it('merges a five-year window into about 260 weekly points', () => {
		const days = 1825;
		expect(bucketSizeFor(days, 400)).toBe(7);
		expect(Math.ceil(days / 7)).toBe(261);
	});

	it('drops to monthly when weekly still overflows', () => {
		expect(bucketSizeFor(10000, 400)).toBe(30);
	});
});

describe('mergeValues', () => {
	it('sums sum-metrics and averages avg-metrics', () => {
		expect(mergeValues([1, 2, 3, 4], 2, 'sum')).toEqual([3, 7]);
		expect(mergeValues([1, 2, 3, 4], 2, 'avg')).toEqual([1.5, 3.5]);
	});

	it('ignores nulls inside a group but keeps an all-null group null', () => {
		expect(mergeValues([1, null, 3, null], 2, 'sum')).toEqual([1, 3]);
		expect(mergeValues([null, null, 5, 5], 2, 'avg')).toEqual([null, 5]);
	});
});

describe('buildDailySeries', () => {
	const startDate = '2026-07-26';

	it('places rows by date and leaves gaps null', () => {
		const series = buildDailySeries({
			metric: 'steps',
			unit: 'count',
			rows: [
				{ date: '2026-07-26', value: 100 },
				{ date: '2026-07-28', value: 300 }
			],
			startDate,
			days: 3
		});

		expect(series.values).toEqual([100, null, 300]);
		expect(series.start).toBe(dateKeyToMs(startDate));
		expect(series.step).toBe(DAY_MS);
		expect(series.count).toBe(3);
		expect(series.kind).toBe('sum');
	});

	// A gap is the reason the API ships nulls at all — zero-filling would draw a
	// flat line where there is simply no data.
	it('never zero-fills a missing day', () => {
		const series = buildDailySeries({
			metric: 'restingHeartRate',
			unit: 'bpm',
			rows: [],
			startDate,
			days: 4
		});
		expect(series.values).toEqual([null, null, null, null]);
	});

	it('drops rows outside the window', () => {
		const series = buildDailySeries({
			metric: 'steps',
			unit: 'count',
			rows: [
				{ date: '2026-07-20', value: 999 },
				{ date: '2026-07-27', value: 7 }
			],
			startDate,
			days: 3
		});
		expect(series.values).toEqual([null, 7, null]);
	});

	it('merges a long window into weekly points and widens the step', () => {
		const days = 1825;
		const rows = Array.from({ length: days }, (_, i) => ({
			date: shiftDateKey(startDate, i),
			value: 10
		}));

		const series = buildDailySeries({ metric: 'steps', unit: 'count', rows, startDate, days });

		expect(series.count).toBe(261);
		expect(series.values).toHaveLength(261);
		expect(series.step).toBe(7 * DAY_MS);
		expect(series.values[0]).toBe(70); // seven days of ten steps, summed
	});
});

describe('buildHourlySeries', () => {
	const startHour = Date.parse('2026-08-01T00:00:00Z');

	it('recomputes the average from the stored components', () => {
		const series = buildHourlySeries({
			metric: 'heartRate',
			unit: 'bpm',
			rows: [
				{ hour: startHour, count: 4, sum: 280, min: 62, max: 84 },
				{ hour: startHour + 2 * HOUR_MS, count: 2, sum: 130, min: 63, max: 67 }
			],
			startHour,
			hours: 3
		});

		expect(series.values).toEqual([70, null, 65]);
		expect(series.min).toEqual([62, null, 63]);
		expect(series.max).toEqual([84, null, 67]);
		expect(series.step).toBe(HOUR_MS);
	});

	it('sums rather than averages a sum-metric bucket', () => {
		const series = buildHourlySeries({
			metric: 'steps',
			unit: 'count',
			rows: [{ hour: startHour, count: 4, sum: 280, min: 40, max: 100 }],
			startHour,
			hours: 1
		});
		expect(series.values).toEqual([280]);
	});
});

describe('workoutExternalId', () => {
	it('is stable across re-syncs of the same workout', () => {
		const start = Date.parse('2026-08-01T06:12:00Z');
		expect(workoutExternalId('running', start)).toBe(workoutExternalId('running', start));
		expect(workoutExternalId('running', start)).not.toBe(workoutExternalId('cycling', start));
	});
});

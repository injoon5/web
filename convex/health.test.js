import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { describe, expect, it } from 'vitest';
import { internal } from './_generated/api.js';
import schema from './schema.js';
import { HOUR_MS, metricUnit, workoutExternalId } from './lib/health.js';

// Built by hand rather than reached through `api.*`, which stays absent from
// convex/ so nothing here can accidentally grow a public entry point.
const publicPage = makeFunctionReference('healthPublic:page');

const modules = import.meta.glob('./**/*.js');

const setup = () => convexTest(schema, modules);

const HOUR = Date.parse('2026-08-01T09:00:00Z');

/** A batch of heart-rate samples one second apart, as the Shortcut would send them. */
function heartRate(count, { from = HOUR } = {}) {
	return Array.from({ length: count }, (_, i) => ({
		metric: 'heartRate',
		value: 60 + (i % 10),
		time: from + i * 1000,
		unit: metricUnit('heartRate')
	}));
}

const bucketsFor = (t, metric) =>
	t.run(async (ctx) =>
		ctx.db
			.query('healthBuckets')
			.withIndex('by_metric_hour', (q) => q.eq('metric', metric))
			.take(100)
	);

describe('ingest: samples and rollups', () => {
	it('folds a batch into one hour bucket', async () => {
		const t = setup();
		const result = await t.mutation(internal.health.ingest, { samples: heartRate(100) });

		expect(result.samplesInserted).toBe(100);
		expect(result.samplesDuplicate).toBe(0);

		const buckets = await bucketsFor(t, 'heartRate');
		expect(buckets).toHaveLength(1);
		expect(buckets[0]).toMatchObject({ hour: HOUR, count: 100, min: 60, max: 69 });
	});

	// The failure the whole rollup tier is built around: a re-sent sample folded
	// into the bucket sum a second time can never be backed out.
	it('stays at 100 when the same 100 samples are posted twice', async () => {
		const t = setup();
		const batch = heartRate(100);

		await t.mutation(internal.health.ingest, { samples: batch });
		const second = await t.mutation(internal.health.ingest, { samples: batch });

		expect(second.samplesInserted).toBe(0);
		expect(second.samplesDuplicate).toBe(100);

		const buckets = await bucketsFor(t, 'heartRate');
		expect(buckets).toHaveLength(1);
		expect(buckets[0].count).toBe(100);

		const rows = await t.run(async (ctx) => ctx.db.query('healthSamples').take(500));
		expect(rows).toHaveLength(100);
	});

	it('folds only the new tail of an overlapping batch', async () => {
		const t = setup();
		const batch = heartRate(100);

		await t.mutation(internal.health.ingest, { samples: batch.slice(0, 60) });
		const second = await t.mutation(internal.health.ingest, { samples: batch });

		expect(second.samplesInserted).toBe(40);

		const buckets = await bucketsFor(t, 'heartRate');
		expect(buckets[0].count).toBe(100);
		expect(buckets[0].sum).toBe(batch.reduce((total, s) => total + s.value, 0));
	});

	it('splits samples across the hours they belong to', async () => {
		const t = setup();
		await t.mutation(internal.health.ingest, {
			samples: [...heartRate(10), ...heartRate(5, { from: HOUR + HOUR_MS })]
		});

		const buckets = await bucketsFor(t, 'heartRate');
		expect(buckets.map((b) => [b.hour, b.count])).toEqual([
			[HOUR, 10],
			[HOUR + HOUR_MS, 5]
		]);
	});
});

describe('ingest: day rollups', () => {
	it('upserts on (metric, date) so an hourly re-send overwrites the day', async () => {
		const t = setup();
		const date = '2026-08-01';

		await t.mutation(internal.health.ingest, {
			date,
			source: 'Apple Watch',
			metrics: [{ metric: 'steps', value: 4000, unit: 'count' }]
		});
		await t.mutation(internal.health.ingest, {
			date,
			source: 'Apple Watch',
			metrics: [{ metric: 'steps', value: 8421, unit: 'count' }]
		});

		const rows = await t.run(async (ctx) => ctx.db.query('healthDaily').take(100));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ date, metric: 'steps', value: 8421 });
	});

	it('keeps separate rows per metric and per day', async () => {
		const t = setup();
		await t.mutation(internal.health.ingest, {
			date: '2026-08-01',
			metrics: [
				{ metric: 'steps', value: 8421, unit: 'count' },
				{ metric: 'restingHeartRate', value: 54, unit: 'bpm' }
			]
		});
		await t.mutation(internal.health.ingest, {
			date: '2026-08-02',
			metrics: [{ metric: 'steps', value: 6000, unit: 'count' }]
		});

		const rows = await t.run(async (ctx) => ctx.db.query('healthDaily').take(100));
		expect(rows).toHaveLength(3);
	});
});

describe('ingest: workouts', () => {
	const start = Date.parse('2026-08-01T06:12:00Z');
	const end = Date.parse('2026-08-01T06:47:30Z');
	const run = {
		externalId: workoutExternalId('running', start),
		type: 'running',
		start,
		end,
		duration: (end - start) / 1000,
		distance: 6.2,
		activeEnergy: 410,
		avgHeartRate: 158,
		maxHeartRate: 176
	};

	it('re-syncing the same workout updates rather than duplicates', async () => {
		const t = setup();

		const first = await t.mutation(internal.health.ingest, { workouts: [run] });
		expect(first.workoutsInserted).toBe(1);

		const second = await t.mutation(internal.health.ingest, {
			workouts: [{ ...run, activeEnergy: 415 }]
		});
		expect(second.workoutsInserted).toBe(0);
		expect(second.workoutsUpdated).toBe(1);

		const rows = await t.run(async (ctx) => ctx.db.query('healthWorkouts').take(100));
		expect(rows).toHaveLength(1);
		expect(rows[0].activeEnergy).toBe(415);
	});
});

describe('reads', () => {
	it('returns a dense daily series with nulls for missing days', async () => {
		const t = setup();
		await t.mutation(internal.health.ingest, {
			date: '2026-07-30',
			metrics: [{ metric: 'steps', value: 5000, unit: 'count' }]
		});
		await t.mutation(internal.health.ingest, {
			date: '2026-08-01',
			metrics: [{ metric: 'steps', value: 8421, unit: 'count' }]
		});

		const series = await t.query(internal.health.dailySeries, {
			metric: 'steps',
			startDate: '2026-07-30',
			days: 3
		});

		expect(series.values).toEqual([5000, null, 8421]);
		expect(series.unit).toBe('count');
	});

	it('reports the latest value per metric', async () => {
		const t = setup();
		await t.mutation(internal.health.ingest, {
			date: '2026-07-31',
			metrics: [
				{ metric: 'steps', value: 100, unit: 'count' },
				{ metric: 'restingHeartRate', value: 58, unit: 'bpm' }
			]
		});
		await t.mutation(internal.health.ingest, {
			date: '2026-08-01',
			metrics: [{ metric: 'steps', value: 8421, unit: 'count' }]
		});

		const { metrics, latestDate } = await t.query(internal.health.latest, {});
		expect(latestDate).toBe('2026-08-01');
		expect(metrics.steps.value).toBe(8421);
		// No row today, so the most recent reading still stands.
		expect(metrics.restingHeartRate).toMatchObject({ value: 58, date: '2026-07-31' });
	});

	it('lists workouts newest first and filters by type', async () => {
		const t = setup();
		const mk = (type, iso) => {
			const start = Date.parse(iso);
			return {
				externalId: workoutExternalId(type, start),
				type,
				start,
				end: start + 30 * 60 * 1000,
				duration: 1800
			};
		};

		await t.mutation(internal.health.ingest, {
			workouts: [
				mk('running', '2026-07-30T06:00:00Z'),
				mk('cycling', '2026-07-31T06:00:00Z'),
				mk('running', '2026-08-01T06:00:00Z')
			]
		});

		const all = await t.query(internal.health.workouts, { startMs: 0, limit: 10 });
		expect(all.map((w) => w.type)).toEqual(['running', 'cycling', 'running']);

		const runs = await t.query(internal.health.workouts, {
			startMs: 0,
			type: 'running',
			limit: 10
		});
		expect(runs).toHaveLength(2);
		expect(runs[0].start).toBeGreaterThan(runs[1].start);
	});

	it('exposes the HTTP routes without importing anything public', async () => {
		const http = await import('./http.js');
		expect(typeof http.default.lookup).toBe('function');
		expect(http.default.lookup('/health/ingest', 'POST')).toBeTruthy();
		expect(http.default.lookup('/health/series', 'GET')).toBeTruthy();
		expect(http.default.lookup('/health/workouts', 'GET')).toBeTruthy();
		expect(http.default.lookup('/health', 'GET')).toBeTruthy();
	});

	it('drops raw samples past the retention cutoff but keeps their buckets', async () => {
		const t = setup();
		await t.mutation(internal.health.ingest, { samples: heartRate(10) });

		const { deleted } = await t.mutation(internal.health.pruneSamples, {
			cutoff: HOUR + HOUR_MS
		});
		expect(deleted).toBe(10);

		const rows = await t.run(async (ctx) => ctx.db.query('healthSamples').take(100));
		expect(rows).toHaveLength(0);

		const buckets = await bucketsFor(t, 'heartRate');
		expect(buckets[0].count).toBe(10);
	});
});

/**
 * The one public query. Its whole justification is that it can serve nothing
 * beyond what /health already shows to any visitor, so that's what gets tested:
 * the metric list is fixed in code, and the range must be one the page offers.
 */
describe('public page query', () => {
	it('serves exactly the page metrics, never an argument-chosen one', async () => {
		const t = setup();
		await t.mutation(internal.health.ingest, {
			date: '2026-08-01',
			metrics: [
				{ metric: 'steps', value: 8421, unit: 'count' },
				{ metric: 'bodyFat', value: 14.2, unit: '%' }
			]
		});

		const { series } = await t.query(publicPage, { startDate: '2026-07-03', days: 30 });

		expect(series.map((s) => s.metric)).toEqual([
			'steps',
			'restingHeartRate',
			'activeEnergy',
			'exerciseMinutes',
			'distance'
		]);
		expect(series.find((s) => s.metric === 'steps').values.at(-1)).toBe(8421);
	});

	it('rejects a range the picker does not offer', async () => {
		const t = setup();
		await expect(t.query(publicPage, { startDate: '2026-07-03', days: 31 })).rejects.toThrow();
		await expect(t.query(publicPage, { startDate: 'yesterday', days: 30 })).rejects.toThrow();
	});
});

/**
 * The HTTP surface, exercised with the exact payloads the two iOS Shortcuts
 * post (`shortcuts/payloads/*.json`). Those fixtures keep Shortcuts' quirks
 * rather than idealised JSON — numbers arrive as strings, `8,421` still carries
 * its thousands separator, workout types are title-cased — because that is what
 * actually shows up on the wire.
 */

import { convexTest } from 'convex-test';
import { beforeEach, describe, expect, it } from 'vitest';
import schema from './schema.js';
import { HOUR_MS } from './lib/health.js';
import metricsPayload from '../shortcuts/payloads/metrics-hourly.json';
import workoutsPayload from '../shortcuts/payloads/workouts-daily.json';

const modules = import.meta.glob('./**/*.js');

const KEY = 'test-health-key';

const setup = () => convexTest(schema, modules);

const post = (t, body, key = KEY) =>
	t.fetch('/health/ingest', {
		method: 'POST',
		headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

const get = (t, path, key = KEY) => t.fetch(path, { headers: { Authorization: `Bearer ${key}` } });

beforeEach(() => {
	process.env.HEALTH_API_KEY = KEY;
});

describe('auth', () => {
	it('refuses a missing, malformed or wrong key', async () => {
		const t = setup();

		expect((await t.fetch('/health', {})).status).toBe(401);
		expect((await t.fetch('/health', { headers: { Authorization: KEY } })).status).toBe(401);
		expect((await get(t, '/health', 'not-the-key')).status).toBe(401);
		expect((await get(t, '/health')).status).toBe(200);
	});

	it('refuses everything when no key is configured', async () => {
		const t = setup();
		delete process.env.HEALTH_API_KEY;
		expect((await get(t, '/health')).status).toBe(401);
	});
});

describe('POST /health/ingest — the metrics shortcut', () => {
	it('accepts the payload as Shortcuts actually sends it', async () => {
		const t = setup();
		const res = await post(t, metricsPayload);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body).toMatchObject({ ok: true, metrics: 6, samplesInserted: 4 });

		const rows = await t.run(async (ctx) => ctx.db.query('healthDaily').take(50));
		const byMetric = Object.fromEntries(rows.map((r) => [r.metric, r]));

		// "8,421" survives the trip; a comma should not 400 the whole sync.
		expect(byMetric.steps).toMatchObject({
			value: 8421,
			unit: 'count',
			date: '2026-08-01',
			source: 'Apple Watch'
		});
		expect(byMetric.distance.value).toBe(6.2);
		expect(byMetric.sleepHours).toMatchObject({ value: 7.4, unit: 'h' });
		expect(byMetric.restingHeartRate).toMatchObject({ value: 54, unit: 'bpm' });
	});

	// The hourly automation re-sends the day every hour, and Run Immediately can
	// fire it twice in a row.
	it('is idempotent when the automation re-fires', async () => {
		const t = setup();
		await post(t, metricsPayload);
		const second = await post(t, metricsPayload);

		expect(await second.json()).toMatchObject({ samplesInserted: 0, samplesDuplicate: 4 });

		const daily = await t.run(async (ctx) => ctx.db.query('healthDaily').take(50));
		const samples = await t.run(async (ctx) => ctx.db.query('healthSamples').take(50));
		const buckets = await t.run(async (ctx) => ctx.db.query('healthBuckets').take(50));

		expect(daily).toHaveLength(6);
		expect(samples).toHaveLength(4);
		expect(buckets).toHaveLength(1);
		expect(buckets[0].count).toBe(4);
	});

	it('rejects a payload spanning more metric-hours than one transaction can dedupe', async () => {
		const t = setup();
		const base = Date.parse('2026-08-01T00:00:00Z');
		const res = await post(t, {
			samples: Array.from({ length: 13 }, (_, i) => ({
				metric: 'heartRate',
				value: 70,
				timestamp: new Date(base + i * HOUR_MS).toISOString()
			}))
		});

		expect(res.status).toBe(400);
		expect((await res.json()).error).toMatch(/split the request/);
	});

	it('rejects a malformed date and a non-numeric metric', async () => {
		const t = setup();
		expect((await post(t, { date: '2026-8-1', metrics: { steps: 1 } })).status).toBe(400);
		expect((await post(t, { date: '2026-08-01', metrics: { steps: 'lots' } })).status).toBe(400);
		expect((await post(t, { date: '2026-08-01', metrics: { 'bad key': 1 } })).status).toBe(400);
	});
});

describe('POST /health/ingest — the workouts shortcut', () => {
	it('normalizes the type and derives a missing duration', async () => {
		const t = setup();
		const res = await post(t, workoutsPayload);
		expect(await res.json()).toMatchObject({ workoutsInserted: 2, workoutsUpdated: 0 });

		const rows = await t.run(async (ctx) => ctx.db.query('healthWorkouts').take(50));
		const run = rows.find((r) => r.type === 'running');

		expect(run).toMatchObject({
			type: 'running',
			distance: 6.2,
			avgHeartRate: 158,
			source: 'Apple Watch'
		});
		// end - start, since the Shortcut sends no duration.
		expect(run.duration).toBe(2130);
		expect(run.externalId).toBe(`running:${Date.parse('2026-08-01T06:12:00Z')}`);
		expect(rows.map((r) => r.type)).toContain('traditional strength training');
	});

	it('re-runs of the daily automation update rather than duplicate', async () => {
		const t = setup();
		await post(t, workoutsPayload);
		const second = await post(t, workoutsPayload);

		expect(await second.json()).toMatchObject({ workoutsInserted: 0, workoutsUpdated: 2 });
		const rows = await t.run(async (ctx) => ctx.db.query('healthWorkouts').take(50));
		expect(rows).toHaveLength(2);
	});
});

describe('GET reads', () => {
	it('returns a dense series and echoes the window it resolved', async () => {
		const t = setup();
		await post(t, metricsPayload);

		const res = await get(t, '/health/series?metrics=steps,restingHeartRate&days=7');
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('private, max-age=300');
		expect(res.headers.get('vary')).toBe('Authorization');

		const { bucket, startDate, days, series } = await res.json();
		expect(bucket).toBe('day');
		expect(days).toBe(7);
		expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(series.map((s) => s.metric)).toEqual(['steps', 'restingHeartRate']);
		expect(series[0].values).toHaveLength(7);
		expect(series[0].step).toBe(86400000);
	});

	it('serves the hourly bucket view with a min/max band', async () => {
		const t = setup();
		// Anchored inside the current hour rather than offset from now, so a run
		// that straddles the hour boundary doesn't split the pair across buckets.
		const hour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
		await post(t, {
			samples: [
				{ metric: 'heartRate', value: 60, timestamp: new Date(hour + 60000).toISOString() },
				{ metric: 'heartRate', value: 90, timestamp: new Date(hour + 120000).toISOString() }
			]
		});

		const { series } = await (
			await get(t, '/health/series?metric=heartRate&bucket=hour&hours=3')
		).json();
		expect(series[0].values.at(-1)).toBe(75);
		expect(series[0].min.at(-1)).toBe(60);
		expect(series[0].max.at(-1)).toBe(90);
	});

	it('lists workouts and filters by type', async () => {
		const t = setup();
		await post(t, workoutsPayload);

		const all = await (await get(t, '/health/workouts?days=365')).json();
		expect(all.workouts).toHaveLength(2);

		const runs = await (await get(t, '/health/workouts?days=365&type=Running')).json();
		expect(runs.workouts).toHaveLength(1);
		expect(runs.workouts[0].type).toBe('running');
	});

	it('reports the latest value per metric and a single day', async () => {
		const t = setup();
		await post(t, metricsPayload);

		const summary = await (await get(t, '/health')).json();
		expect(summary.latestDate).toBe('2026-08-01');
		expect(summary.metrics.steps.value).toBe(8421);

		const day = await (await get(t, '/health/day?date=2026-08-01')).json();
		expect(day.metrics.exerciseMinutes.value).toBe(43);
	});

	it('rejects an unknown metric name rather than scanning for it', async () => {
		const t = setup();
		expect((await get(t, '/health/series?metrics=drop%20table')).status).toBe(400);
		expect((await get(t, '/health/series')).status).toBe(400);
	});
});

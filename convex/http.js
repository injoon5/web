/**
 * The only public surface for health data.
 *
 * Everything in `convex/health.js` is internal, so this key-checking action is
 * the single door in. It also owns all the parsing: Shortcuts sends loosely
 * typed dictionaries (numbers as strings, timestamps as ISO text), and the
 * mutation should receive values that are already clean.
 *
 * Time bounds are computed here rather than inside the queries — a query doesn't
 * re-run when the clock moves, so a `Date.now()` bound would go stale and churn
 * the query cache. These are snapped to a whole day or hour for the same reason.
 */

import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server.js';
import { internal } from './_generated/api.js';
import { secretsMatch } from './lib/secrets.js';
import {
	DAY_MS,
	DEFAULT_MAX_POINTS,
	HOUR_MS,
	MAX_HOURS_PER_INGEST,
	MAX_SERIES_DAYS,
	MAX_SERIES_HOURS,
	dateKey,
	dateKeyToMs,
	hourFloor,
	isDateKey,
	metricUnit,
	parseInstant,
	shiftDateKey,
	workoutExternalId
} from './lib/health.js';

const INGEST_LIMITS = {
	metrics: 64,
	samples: 1000,
	workouts: 100,
	/** Distinct (metric, hour) hours a payload may touch — see HOUR_SCAN_LIMIT. */
	hours: MAX_HOURS_PER_INGEST
};

const METRIC_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

// Callers should stick to coarse ranges (7/30/90/365): every distinct `days`
// value is a distinct query argument, and so a distinct Convex cache entry.
const DEFAULT_DAYS = 30;
const DEFAULT_HOURS = 24;
const DEFAULT_WORKOUT_LIMIT = 50;

class BadRequest extends Error {}

// ---------------------------------------------------------------------------
// Auth + response helpers
// ---------------------------------------------------------------------------

async function authorized(request) {
	const header = request.headers.get('authorization') ?? '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	if (!match) return false;
	return await secretsMatch(match[1].trim(), process.env.HEALTH_API_KEY);
}

function json(body, { status = 200, cache } = {}) {
	const headers = { 'Content-Type': 'application/json' };
	if (cache) {
		// Responses vary by key and are one person's health data, so never let a
		// shared cache hold them — only the client that sent the key may reuse it.
		headers['Cache-Control'] = `private, max-age=${cache}`;
		headers['Vary'] = 'Authorization';
	}
	return new Response(JSON.stringify(body), { status, headers });
}

/** Wrap a handler with bearer auth and BadRequest -> 400 mapping. */
function guarded(handler) {
	return httpAction(async (ctx, request) => {
		if (!(await authorized(request))) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		try {
			return await handler(ctx, request);
		} catch (err) {
			if (err instanceof BadRequest) return json({ error: err.message }, { status: 400 });
			throw err;
		}
	});
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Shortcuts dictionaries stringify numbers often enough to just accept both. */
function toNumber(value, label) {
	const num = typeof value === 'string' ? Number(value.trim()) : value;
	if (typeof num !== 'number' || !Number.isFinite(num)) {
		throw new BadRequest(`${label} must be a number`);
	}
	return num;
}

function optionalNumber(value, label) {
	if (value === undefined || value === null || value === '') return undefined;
	return toNumber(value, label);
}

function metricName(value, label) {
	if (typeof value !== 'string' || !METRIC_NAME.test(value)) {
		throw new BadRequest(`${label} must be an identifier like "restingHeartRate"`);
	}
	return value;
}

function instant(value, label) {
	const ms = parseInstant(value);
	if (ms === null) throw new BadRequest(`${label} must be an ISO-8601 timestamp or epoch ms`);
	return ms;
}

function intParam(url, name, { fallback, min, max }) {
	const raw = url.searchParams.get(name);
	if (raw === null || raw === '') return fallback;
	const num = Number(raw);
	if (!Number.isFinite(num)) throw new BadRequest(`${name} must be a number`);
	return Math.min(Math.max(Math.floor(num), min), max);
}

function parseMetrics(raw) {
	if (raw === undefined || raw === null) return [];
	if (typeof raw !== 'object' || Array.isArray(raw)) {
		throw new BadRequest('metrics must be an object of metric -> value');
	}

	const entries = Object.entries(raw);
	if (entries.length > INGEST_LIMITS.metrics) {
		throw new BadRequest(`metrics is limited to ${INGEST_LIMITS.metrics} entries`);
	}

	return entries.map(([name, value]) => {
		const metric = metricName(name, `metrics key "${name}"`);
		return {
			metric,
			value: toNumber(value, `metrics.${metric}`),
			unit: metricUnit(metric)
		};
	});
}

function parseSamples(raw) {
	if (raw === undefined || raw === null) return [];
	if (!Array.isArray(raw)) throw new BadRequest('samples must be an array');
	if (raw.length > INGEST_LIMITS.samples) {
		throw new BadRequest(`samples is limited to ${INGEST_LIMITS.samples} per request`);
	}

	const samples = raw.map((entry, i) => {
		if (!entry || typeof entry !== 'object') {
			throw new BadRequest(`samples[${i}] must be an object`);
		}
		const metric = metricName(entry.metric, `samples[${i}].metric`);
		return {
			metric,
			value: toNumber(entry.value, `samples[${i}].value`),
			time: instant(entry.timestamp ?? entry.time, `samples[${i}].timestamp`),
			unit: metricUnit(metric),
			source: typeof entry.source === 'string' ? entry.source : undefined
		};
	});

	// The ingest reads one dedupe window per touched hour, so the hour count —
	// not the sample count — is what bounds the transaction.
	const hours = new Set(samples.map((s) => `${s.metric} ${hourFloor(s.time)}`));
	if (hours.size > INGEST_LIMITS.hours) {
		throw new BadRequest(
			`samples span ${hours.size} metric-hours; split the request into batches of ${INGEST_LIMITS.hours}`
		);
	}

	return samples;
}

function parseWorkouts(raw, defaultSource) {
	if (raw === undefined || raw === null) return [];
	if (!Array.isArray(raw)) throw new BadRequest('workouts must be an array');
	if (raw.length > INGEST_LIMITS.workouts) {
		throw new BadRequest(`workouts is limited to ${INGEST_LIMITS.workouts} per request`);
	}

	return raw.map((entry, i) => {
		if (!entry || typeof entry !== 'object') {
			throw new BadRequest(`workouts[${i}] must be an object`);
		}
		if (typeof entry.type !== 'string' || entry.type.trim() === '') {
			throw new BadRequest(`workouts[${i}].type is required`);
		}

		const type = entry.type.trim().toLowerCase();
		const start = instant(entry.start, `workouts[${i}].start`);
		const end = instant(entry.end, `workouts[${i}].end`);
		if (end < start) throw new BadRequest(`workouts[${i}].end precedes start`);

		return {
			// Shortcuts exposes no workout UUID, so identity is (type, start) —
			// stable across the daily re-sync that re-reports the same workout.
			externalId: workoutExternalId(type, start),
			type,
			start,
			end,
			duration: optionalNumber(entry.duration, `workouts[${i}].duration`) ?? (end - start) / 1000,
			distance: optionalNumber(entry.distance, `workouts[${i}].distance`),
			activeEnergy: optionalNumber(entry.activeEnergy, `workouts[${i}].activeEnergy`),
			avgHeartRate: optionalNumber(entry.avgHeartRate, `workouts[${i}].avgHeartRate`),
			maxHeartRate: optionalNumber(entry.maxHeartRate, `workouts[${i}].maxHeartRate`),
			elevation: optionalNumber(entry.elevation, `workouts[${i}].elevation`),
			source: typeof entry.source === 'string' ? entry.source : defaultSource
		};
	});
}

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/**
 * The last day a series covers.
 *
 * A day key is written in the phone's local calendar, which can be a day ahead
 * of UTC, so the window reaches one day past UTC-today. The extra slot is null
 * for anyone at or behind UTC — which is exactly what a day with no data should
 * look like.
 */
function windowEndDate(now) {
	return dateKey(now + DAY_MS);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const ingest = guarded(async (ctx, request) => {
	let body;
	try {
		body = await request.json();
	} catch {
		throw new BadRequest('Body must be JSON');
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new BadRequest('Body must be a JSON object');
	}

	const metrics = parseMetrics(body.metrics);
	const samples = parseSamples(body.samples);
	const source = typeof body.source === 'string' ? body.source : undefined;
	const workouts = parseWorkouts(body.workouts, source);

	if (body.date !== undefined && body.date !== null && !isDateKey(body.date)) {
		throw new BadRequest('date must be YYYY-MM-DD');
	}
	// Only day rows need a date; a samples- or workouts-only payload carries its
	// own timestamps.
	const date = body.date ?? (metrics.length ? dateKey(Date.now()) : undefined);

	const result = await ctx.runMutation(internal.health.ingest, {
		date,
		source,
		metrics,
		samples,
		workouts
	});

	return json({ ok: true, ...result });
});

const series = guarded(async (ctx, request) => {
	const url = new URL(request.url);
	const maxPoints = intParam(url, 'maxPoints', {
		fallback: DEFAULT_MAX_POINTS,
		min: 10,
		max: 2000
	});

	const requested = (url.searchParams.get('metrics') ?? url.searchParams.get('metric') ?? '')
		.split(',')
		.map((name) => name.trim())
		.filter(Boolean);

	if (requested.length === 0) throw new BadRequest('metrics is required');
	if (requested.length > 8) throw new BadRequest('metrics is limited to 8 per request');
	const metrics = requested.map((name, i) => metricName(name, `metrics[${i}]`));

	const now = Date.now();

	if (url.searchParams.get('bucket') === 'hour') {
		const hours = intParam(url, 'hours', {
			fallback: DEFAULT_HOURS,
			min: 1,
			max: MAX_SERIES_HOURS
		});
		const startHour = hourFloor(now) + HOUR_MS - hours * HOUR_MS;

		const resolved = await Promise.all(
			metrics.map((metric) =>
				ctx.runQuery(internal.health.hourlySeries, { metric, startHour, hours, maxPoints })
			)
		);
		return json({ bucket: 'hour', startHour, hours, series: resolved }, { cache: 300 });
	}

	const days = intParam(url, 'days', { fallback: DEFAULT_DAYS, min: 1, max: MAX_SERIES_DAYS });
	const startDate = shiftDateKey(windowEndDate(now), -(days - 1));

	const resolved = await Promise.all(
		metrics.map((metric) =>
			ctx.runQuery(internal.health.dailySeries, { metric, startDate, days, maxPoints })
		)
	);
	// The window is echoed back so a caller can keep watching the same one — the
	// /health page hands `startDate` to its realtime subscription rather than
	// recomputing "today" on the client and drifting a day away from the render.
	return json({ bucket: 'day', startDate, days, series: resolved }, { cache: 300 });
});

const workoutList = guarded(async (ctx, request) => {
	const url = new URL(request.url);
	const days = intParam(url, 'days', { fallback: 90, min: 1, max: MAX_SERIES_DAYS });
	const limit = intParam(url, 'limit', { fallback: DEFAULT_WORKOUT_LIMIT, min: 1, max: 200 });
	const rawType = url.searchParams.get('type');
	const type = rawType ? rawType.trim().toLowerCase() : undefined;

	const startDate = shiftDateKey(windowEndDate(Date.now()), -(days - 1));
	const rows = await ctx.runQuery(internal.health.workouts, {
		startMs: dateKeyToMs(startDate),
		type,
		limit
	});

	return json({ days, type: type ?? null, workouts: rows }, { cache: 300 });
});

const summary = guarded(async (ctx) => {
	const result = await ctx.runQuery(internal.health.latest, {});
	return json(result, { cache: 60 });
});

const day = guarded(async (ctx, request) => {
	const url = new URL(request.url);
	const date = url.searchParams.get('date') ?? dateKey(Date.now());
	if (!isDateKey(date)) throw new BadRequest('date must be YYYY-MM-DD');

	return json(await ctx.runQuery(internal.health.day, { date }), { cache: 60 });
});

const sampleList = guarded(async (ctx, request) => {
	const url = new URL(request.url);
	const metric = metricName(url.searchParams.get('metric'), 'metric');
	const hours = intParam(url, 'hours', { fallback: 24, min: 1, max: MAX_SERIES_HOURS });
	const limit = intParam(url, 'limit', { fallback: 500, min: 1, max: 1000 });

	const endMs = hourFloor(Date.now()) + HOUR_MS;
	const rows = await ctx.runQuery(internal.health.samples, {
		metric,
		startMs: endMs - hours * HOUR_MS,
		endMs,
		limit
	});

	return json({ metric, hours, samples: rows }, { cache: 60 });
});

const http = httpRouter();

http.route({ path: '/health/ingest', method: 'POST', handler: ingest });
http.route({ path: '/health/series', method: 'GET', handler: series });
http.route({ path: '/health/workouts', method: 'GET', handler: workoutList });
http.route({ path: '/health/day', method: 'GET', handler: day });
http.route({ path: '/health/samples', method: 'GET', handler: sampleList });
http.route({ path: '/health', method: 'GET', handler: summary });

export default http;

/**
 * Pure helpers for the Apple Health tier (no `ctx`, no `Date.now()`), so the
 * rollup arithmetic and the series densifying are unit-testable on their own.
 *
 * Convex modules export functions only, so metric semantics live in
 * `metricKind()` / `metricUnit()` rather than a const map.
 */

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** Default cap on points in a series response before days merge into coarser buckets. */
export const DEFAULT_MAX_POINTS = 400;

/**
 * Per-hour dedupe window. An ingest reads the samples already in each touched
 * hour so a re-sent sample is never folded into the bucket twice; that read is
 * what these two caps bound.
 *
 * Convex allows ~16k document reads per transaction, so hours × scan has to stay
 * under it: 12 × 1000 = 12000. A payload spanning more hours is rejected rather
 * than silently truncated.
 */
export const HOUR_SCAN_LIMIT = 1000;
export const MAX_HOURS_PER_INGEST = 12;

/** Longest window a single series read will scan. */
export const MAX_SERIES_DAYS = 1825; // 5 years
export const MAX_SERIES_HOURS = 24 * 90;

/**
 * The exact surface the public /health page renders, and therefore the only
 * thing the realtime subscription is allowed to serve. Everything else — other
 * metrics, hourly buckets, raw samples — stays behind the key.
 */
export const PUBLIC_METRICS = ['steps', 'activeEnergy', 'exerciseMinutes', 'distance'];

/** Range picker steps. Coarse on purpose: each distinct value is a distinct cache entry. */
export const PUBLIC_RANGES = [7, 30, 90, 365];

/**
 * How a metric composes across time.
 *
 * `sum` metrics are totals over a window (steps in an hour add up to steps in a
 * day); `avg` metrics are instantaneous readings that only ever average.
 */
export function metricKind(metric) {
	switch (metric) {
		case 'steps':
		case 'distance':
		case 'activeEnergy':
		case 'basalEnergy':
		case 'exerciseMinutes':
		case 'standHours':
		case 'flightsClimbed':
		case 'mindfulMinutes':
			return 'sum';
		default:
			// heartRate, restingHeartRate, hrv, respiratoryRate, vo2Max, weight,
			// bodyFat, oxygenSaturation, walkingHeartRateAverage, …
			return 'avg';
	}
}

/** Display unit for a metric. Shortcuts sends bare numbers, so the unit is ours to know. */
export function metricUnit(metric) {
	switch (metric) {
		case 'steps':
			return 'count';
		case 'flightsClimbed':
			return 'flights';
		case 'standHours':
			return 'hours';
		case 'distance':
			return 'km';
		case 'activeEnergy':
		case 'basalEnergy':
			return 'kcal';
		case 'exerciseMinutes':
		case 'mindfulMinutes':
			return 'min';
		case 'heartRate':
		case 'restingHeartRate':
		case 'walkingHeartRateAverage':
			return 'bpm';
		case 'hrv':
			return 'ms';
		case 'respiratoryRate':
			return 'breaths/min';
		case 'oxygenSaturation':
		case 'bodyFat':
			return '%';
		case 'vo2Max':
			return 'ml/kg·min';
		case 'weight':
			return 'kg';
		default:
			return '';
	}
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value) {
	if (typeof value !== 'string' || !DATE_KEY.test(value)) return false;
	const ms = Date.parse(`${value}T00:00:00.000Z`);
	return Number.isFinite(ms) && dateKey(ms) === value;
}

/** `YYYY-MM-DD` for an epoch-ms instant, in UTC. */
export function dateKey(ms) {
	return new Date(ms).toISOString().slice(0, 10);
}

/** Epoch ms of UTC midnight opening a `YYYY-MM-DD` key. */
export function dateKeyToMs(date) {
	return Date.parse(`${date}T00:00:00.000Z`);
}

/** Shift a `YYYY-MM-DD` key by whole days. */
export function shiftDateKey(date, days) {
	return dateKey(dateKeyToMs(date) + days * DAY_MS);
}

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. */
export function dateKeyDiff(from, to) {
	return Math.round((dateKeyToMs(to) - dateKeyToMs(from)) / DAY_MS);
}

export function hourFloor(ms) {
	return Math.floor(ms / HOUR_MS) * HOUR_MS;
}

/**
 * Accepts an ISO-8601 string or epoch ms; returns epoch ms, or null when the
 * value isn't a usable instant.
 */
export function parseInstant(value) {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value !== 'string') return null;
	const ms = Date.parse(value);
	return Number.isFinite(ms) ? ms : null;
}

/**
 * Stable identity for a workout across re-syncs. Shortcuts exposes no workout
 * UUID, but (type, start instant) is unique in practice and stable — the same
 * run re-sent tomorrow lands on the same row.
 */
export function workoutExternalId(type, startMs) {
	return `${type}:${startMs}`;
}

/**
 * Split incoming samples into the ones that are genuinely new for this hour and
 * the bucket delta they contribute.
 *
 * This is the guard against permanently corrupting a chart: a re-sent sample
 * folded into a bucket sum a second time can never be backed out. `existingTimes`
 * is what the hour already holds; anything matching (or repeated inside the
 * batch) is dropped before it reaches the rollup.
 */
export function foldSamples(existingTimes, incoming) {
	const seen = new Set(existingTimes);
	const inserts = [];

	for (const sample of incoming) {
		if (seen.has(sample.time)) continue;
		seen.add(sample.time);
		inserts.push(sample);
	}

	if (inserts.length === 0) return { inserts, delta: null };

	let sum = 0;
	let min = Infinity;
	let max = -Infinity;
	for (const { value } of inserts) {
		sum += value;
		if (value < min) min = value;
		if (value > max) max = value;
	}

	return { inserts, delta: { count: inserts.length, sum, min, max } };
}

/** Merge a bucket delta into an existing bucket row (or into nothing, for a new one). */
export function applyBucketDelta(existing, delta) {
	if (!existing) return { ...delta };
	return {
		count: existing.count + delta.count,
		sum: existing.sum + delta.sum,
		min: Math.min(existing.min, delta.min),
		max: Math.max(existing.max, delta.max)
	};
}

/**
 * Days per point, so a long window returns roughly `maxPoints` values instead of
 * one per day. 1 → daily, 7 → weekly, 30 → monthly.
 */
export function bucketSizeFor(count, maxPoints = DEFAULT_MAX_POINTS) {
	if (count <= maxPoints) return 1;
	if (Math.ceil(count / 7) <= maxPoints) return 7;
	return 30;
}

/**
 * Collapse a dense array into groups of `size`, summing or averaging the
 * non-null members. An all-null group stays null — a gap is never invented into
 * a zero.
 *
 * A trailing partial group reads low for `sum` metrics (four days of steps in a
 * seven-day slot), which is the honest reading of the data we have.
 */
export function mergeValues(values, size, kind) {
	if (size <= 1) return values;

	const merged = [];
	for (let i = 0; i < values.length; i += size) {
		let total = 0;
		let seen = 0;
		for (let j = i; j < Math.min(i + size, values.length); j++) {
			if (values[j] === null) continue;
			total += values[j];
			seen++;
		}
		merged.push(seen === 0 ? null : kind === 'sum' ? total : total / seen);
	}
	return merged;
}

/** Collapse a dense extremum array into groups of `size` (null-preserving). */
function mergeExtrema(values, size, pick) {
	if (size <= 1) return values;

	const merged = [];
	for (let i = 0; i < values.length; i += size) {
		let acc = null;
		for (let j = i; j < Math.min(i + size, values.length); j++) {
			if (values[j] === null) continue;
			acc = acc === null ? values[j] : pick(acc, values[j]);
		}
		merged.push(acc);
	}
	return merged;
}

function round(value) {
	// Float noise from repeated summing shouldn't ship over the wire.
	return value === null ? null : Math.round(value * 1000) / 1000;
}

/**
 * Dense daily series: one slot per day from `startDate`, nulls for days with no
 * row, then merged down to at most `maxPoints` points.
 *
 * Dense arrays rather than `{date, value}` objects: half the bytes, and x is
 * `start + index * step`, so dates never ship.
 */
export function buildDailySeries({ metric, unit, rows, startDate, days, maxPoints }) {
	const values = new Array(days).fill(null);
	// Newest write inside the window, so the page can say when the data last
	// moved. Rows outside the window don't count — they aren't being shown.
	let updatedAt = null;

	for (const row of rows) {
		const i = dateKeyDiff(startDate, row.date);
		if (i < 0 || i >= days) continue;
		values[i] = row.value;
		if (typeof row.updatedAt === 'number' && (updatedAt === null || row.updatedAt > updatedAt)) {
			updatedAt = row.updatedAt;
		}
	}

	const size = bucketSizeFor(days, maxPoints);
	const kind = metricKind(metric);

	return {
		metric,
		unit,
		kind,
		start: dateKeyToMs(startDate),
		step: size * DAY_MS,
		count: Math.ceil(days / size),
		updatedAt,
		values: mergeValues(values, size, kind).map(round)
	};
}

/**
 * Newest write across a set of series, or null when none of them holds one.
 *
 * Shared by the public query and the SSR load so "Updated 3 hours ago" means the
 * same thing whichever path rendered the page.
 */
export function latestSeriesUpdate(series) {
	let newest = null;
	for (const one of series) {
		const at = one?.updatedAt;
		if (typeof at !== 'number') continue;
		if (newest === null || at > newest) newest = at;
	}
	return newest;
}

/**
 * Dense hourly series with a min/max band. Buckets store count/sum/min/max, so
 * the average is recomputed here from the components rather than re-averaging a
 * stored mean.
 */
export function buildHourlySeries({ metric, unit, rows, startHour, hours, maxPoints }) {
	const values = new Array(hours).fill(null);
	const mins = new Array(hours).fill(null);
	const maxes = new Array(hours).fill(null);
	const kind = metricKind(metric);

	for (const row of rows) {
		const i = Math.round((row.hour - startHour) / HOUR_MS);
		if (i < 0 || i >= hours || row.count === 0) continue;
		values[i] = kind === 'sum' ? row.sum : row.sum / row.count;
		mins[i] = row.min;
		maxes[i] = row.max;
	}

	const size = bucketSizeFor(hours, maxPoints);

	return {
		metric,
		unit,
		kind,
		start: startHour,
		step: size * HOUR_MS,
		count: Math.ceil(hours / size),
		values: mergeValues(values, size, kind).map(round),
		min: mergeExtrema(mins, size, Math.min).map(round),
		max: mergeExtrema(maxes, size, Math.max).map(round)
	};
}

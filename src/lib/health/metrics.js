/**
 * What the /health page shows and how each number reads.
 *
 * The number is the headline, so formatting lives here rather than in the
 * component: one place decides that steps get thousands separators and distance
 * gets one decimal. Everything here is pure, so the arithmetic behind the score
 * and the chart markers is unit-testable without a DOM.
 */

import { PUBLIC_METRICS, PUBLIC_RANGES, shiftDateKey } from '$convex/lib/health.js';

/**
 * How each metric reads, and the daily target it is scored against.
 *
 * The key list itself lives in Convex, which enforces it. `goal` is a personal
 * target, not a medical one — it exists so five metrics in five different units
 * can be averaged into one number.
 */
const PRESENTATION = {
	steps: { label: 'Steps', unit: '', decimals: 0, goal: 10000 },
	sleepHours: { label: 'Sleep', unit: 'h', decimals: 1, goal: 8 },
	activeEnergy: { label: 'Active energy', unit: 'kcal', decimals: 0, goal: 500 },
	exerciseMinutes: { label: 'Exercise', unit: 'min', decimals: 0, goal: 30 },
	distance: { label: 'Walking + running distance', unit: 'km', decimals: 1, goal: 7 }
};

const FALLBACK = { label: '', unit: '', decimals: 0, goal: 0 };

/**
 * Metrics rendered as sections, in order. Derived from the Convex allowlist so
 * the page and the public query can't drift apart — adding a section means
 * widening what the query is permitted to serve, deliberately.
 */
export const PAGE_METRICS = PUBLIC_METRICS.map((key) => ({
	key,
	...FALLBACK,
	label: key,
	...PRESENTATION[key]
}));

/** Range picker steps. Kept coarse so every view hits the same Convex query cache entries. */
export const RANGES = PUBLIC_RANGES;
export const DEFAULT_RANGE = 30;

/**
 * First day of a window ending on `endDate`.
 *
 * The end of the window comes from the server render, never from the visitor's
 * clock: the range picker only changes how far back the window reaches, so
 * switching ranges can't drift the page a day away from what was rendered.
 */
export function rangeStartDate(endDate, days) {
	return shiftDateKey(endDate, -(days - 1));
}

const formatters = new Map();

function numberFormat(decimals) {
	let format = formatters.get(decimals);
	if (!format) {
		format = new Intl.NumberFormat('en', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
		formatters.set(decimals, format);
	}
	return format;
}

/** True when a slot in a series actually holds a reading. */
export function isFilled(value) {
	return value !== null && value !== undefined && Number.isFinite(value);
}

/** An em dash for a missing value — a gap is never dressed up as a zero. */
export function formatValue(value, decimals = 0) {
	if (!isFilled(value)) return '—';
	return numberFormat(decimals).format(value);
}

const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
const longDateFormat = new Intl.DateTimeFormat('en', {
	month: 'short',
	day: 'numeric',
	year: 'numeric'
});
const stampFormat = new Intl.DateTimeFormat('en', {
	month: 'long',
	day: 'numeric',
	year: 'numeric',
	hour: 'numeric',
	minute: '2-digit'
});

export function formatDay(ms) {
	return dateFormat.format(new Date(ms));
}

export function formatFullDay(ms) {
	return longDateFormat.format(new Date(ms));
}

/** Absolute stamp for the `title` behind a relative "updated …" line. */
export function formatStamp(ms) {
	return stampFormat.format(new Date(ms));
}

const RELATIVE_UNITS = [
	{ unit: 'year', secs: 60 * 60 * 24 * 365 },
	{ unit: 'month', secs: 60 * 60 * 24 * 30 },
	{ unit: 'week', secs: 60 * 60 * 24 * 7 },
	{ unit: 'day', secs: 60 * 60 * 24 },
	{ unit: 'hour', secs: 60 * 60 },
	{ unit: 'minute', secs: 60 }
];

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * "3 hours ago" for an ingest timestamp. `now` is a parameter so the caller
 * decides when the clock is read — a component reads it once on mount rather
 * than on every re-render.
 */
export function formatRelative(ms, now = Date.now()) {
	const diff = Math.round((ms - now) / 1000);
	const abs = Math.abs(diff);
	for (const { unit, secs } of RELATIVE_UNITS) {
		if (abs >= secs) return relativeFormat.format(Math.round(diff / secs), unit);
	}
	return 'just now';
}

/**
 * Label for a point in a series. Merged windows cover a span rather than a day,
 * so they read as a range.
 */
export function formatPointLabel(start, step, index, dayMs = 86400000) {
	const from = start + index * step;
	if (step <= dayMs) return formatFullDay(from);
	return `${formatDay(from)} – ${formatDay(from + step - dayMs)}`;
}

/** Index of the newest point that actually has a value. */
export function lastFilledIndex(values) {
	for (let i = values.length - 1; i >= 0; i--) {
		if (isFilled(values[i])) return i;
	}
	return -1;
}

/**
 * Points a line cannot draw: a reading with a gap on both sides.
 *
 * A stroke needs two points, so a single day of data — or a day marooned
 * between gaps — leaves the chart blank however good the data is. Those get a
 * dot instead, which is why one ingest is enough to see something.
 */
export function isolatedPoints(values) {
	const points = [];
	for (let i = 0; i < values.length; i++) {
		if (!isFilled(values[i])) continue;
		if (isFilled(values[i - 1]) || isFilled(values[i + 1])) continue;
		points.push({ i, value: values[i] });
	}
	return points;
}

/**
 * y-domain with a little breathing room, so a line never sits flush against the
 * top or bottom of its box. A flat series still gets a band to sit in.
 */
export function valueDomain(values) {
	let min = Infinity;
	let max = -Infinity;
	for (const value of values) {
		if (!isFilled(value)) continue;
		if (value < min) min = value;
		if (value > max) max = value;
	}
	if (min === Infinity) return [0, 1];
	if (min === max) return [min - Math.abs(min) * 0.1 - 1, max + Math.abs(max) * 0.1 + 1];
	const pad = (max - min) * 0.12;
	return [min - pad, max + pad];
}

/**
 * Newest point where any metric reported, or -1 for an empty page.
 *
 * The page needs one index rather than five: the score, the headline numbers
 * and the marker all have to describe the same day, and a metric that hasn't
 * synced yet shouldn't drag the others back a day with it.
 */
export function latestIndex(sections) {
	let newest = -1;
	for (const { series } of sections) {
		const at = lastFilledIndex(series?.values ?? []);
		if (at > newest) newest = at;
	}
	return newest;
}

/**
 * One number for a day: how close each metric came to its goal, averaged over
 * the metrics that actually reported.
 *
 * Averaging only what reported is the point. A day whose sleep hasn't synced
 * shouldn't read as a day with no sleep — it scores on what it has, and
 * `counted` says how much that was, so the page can be honest about a partial
 * day rather than quietly scoring it out of five.
 *
 * Each metric is capped at its goal: a 30 km walk banks a perfect distance
 * score, it does not pay for a night of no sleep.
 */
export function dayScore(sections, index) {
	let total = 0;
	let counted = 0;

	for (const { metric, series } of sections) {
		if (!metric.goal) continue;
		const value = (series?.values ?? [])[index];
		if (!isFilled(value)) continue;
		total += Math.min(value / metric.goal, 1);
		counted++;
	}

	const of = sections.filter((s) => s.metric.goal).length;
	if (counted === 0) return { score: null, counted: 0, of };
	return { score: Math.round((total / counted) * 100), counted, of };
}

/** How a score reads in one word. Bands are wide on purpose — this is a mood, not a grade. */
export function scoreLabel(score) {
	if (score === null) return 'No data';
	if (score >= 85) return 'Excellent';
	if (score >= 65) return 'Good';
	if (score >= 40) return 'Fair';
	return 'Light';
}

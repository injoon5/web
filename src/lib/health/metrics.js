/**
 * What the /health page shows and how each number reads. Everything here is
 * pure, so the score and chart arithmetic is testable without a DOM.
 */

import { PUBLIC_METRICS, PUBLIC_RANGES, shiftDateKey } from '$convex/lib/health.js';

/**
 * How each metric reads, and the daily target it is scored against. The key list
 * is enforced in Convex. `goal` is a personal target, not a medical one — it
 * exists so metrics in different units can be averaged into one number.
 */
const PRESENTATION = {
	steps: { label: 'Steps', unit: '', decimals: 0, goal: 10000 },
	activeEnergy: { label: 'Active energy', unit: 'kcal', decimals: 0, goal: 500 },
	exerciseMinutes: { label: 'Exercise', unit: 'min', decimals: 0, goal: 30 },
	distance: { label: 'Walking + running distance', unit: 'km', decimals: 1, goal: 7 }
};

const FALLBACK = { label: '', unit: '', decimals: 0, goal: 0 };

/**
 * Sections in order, derived from the Convex allowlist so the page and the
 * public query cannot drift apart.
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
 * First day of a window ending on `endDate`. The end comes from the server
 * render, never the visitor's clock, so switching ranges cannot drift the page
 * a day away from what was rendered.
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

/** An em dash for a value outside the tracked window; a gap inside it reads as 0. */
export function formatValue(value, decimals = 0) {
	if (!isFilled(value)) return '—';
	return numberFormat(decimals).format(value);
}

/**
 * Short form for an axis label: `12k`, `1.2k`, `430`. The headline carries the
 * exact number; the axis has a ~30px gutter.
 */
export function formatCompact(value, decimals = 0) {
	if (!isFilled(value)) return '';
	// The floor of most of these domains, and it is a zero however many decimals
	// the metric carries — `0.0 km` on an axis is just noise.
	if (value === 0) return '0';

	const abs = Math.abs(value);
	if (abs >= 10000) return `${Math.round(value / 1000)}k`;
	if (abs >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
	// Decimals only where they carry information. `6.2` says something about a
	// day's distance; `20.0` at the top of an axis is a decimal point and a zero
	// spent saying "twenty".
	return numberFormat(abs >= 10 ? 0 : decimals).format(value);
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
 * decides when the clock is read.
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
 * A day that reported nothing is a day the metric was zero — drawing a gap as a
 * break made a rest day look like an outage.
 *
 * The trailing edge is the exception: everything after a metric's newest reading
 * is cut rather than zeroed, so a metric that hasn't synced today doesn't dive
 * to the floor on its own right-hand edge. `dayScore` deliberately does NOT
 * follow this rule — see the note there.
 */
export function zeroFilled(values) {
	const last = lastFilledIndex(values);
	if (last < 0) return [];
	const filled = new Array(last + 1);
	for (let i = 0; i <= last; i++) filled[i] = isFilled(values[i]) ? values[i] : 0;
	return filled;
}

/**
 * The value to show for one slot: a reading, a zero inside the tracked window,
 * or nothing at all past the newest reading.
 */
export function valueAt(values, index) {
	if (index < 0 || index > lastFilledIndex(values)) return null;
	return isFilled(values[index]) ? values[index] : 0;
}

/**
 * y-domain with breathing room, so a line never sits flush against its box. The
 * floor stops at zero — none of these metrics go negative — so the bottom is a
 * number the axis can name.
 */
export function valueDomain(values, headroom = 0.12) {
	let min = Infinity;
	let max = -Infinity;
	for (const value of values) {
		if (!isFilled(value)) continue;
		if (value < min) min = value;
		if (value > max) max = value;
	}
	if (min === Infinity) return [0, 1];

	// A flat series has no range to take a fraction of, so it gets a band scaled
	// to the value itself — plus one, so a flat zero still has somewhere to sit.
	const pad = min === max ? Math.abs(max) * 0.1 + 1 : (max - min) * headroom;
	return [min >= 0 ? Math.max(0, min - pad) : min - pad, max + pad];
}

/**
 * Newest point where any metric reported, or -1 for an empty page. One index for
 * the whole page: the score, the headlines and the marker must all describe the
 * same day.
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
 * Thin d3's candidate y ticks down to what a box this tall can show. d3 treats
 * the count as a hint and rounds outward, cannot know two of its numbers format
 * to the same string, and has never seen the box.
 *
 * Sample down to the count, ends first — the highest and lowest say how far the
 * line travels — then drop anything that would print a duplicate label or land
 * within a line-height of one.
 */
export function pickAxisTicks(
	candidates,
	{ domain, count = 2, plotHeight, decimals = 0, minGap = 16 }
) {
	const [lo, hi] = domain;
	const span = hi - lo;
	if (!(span > 0) || !candidates.length) return [];

	const sorted = [...candidates].sort((a, b) => a - b);
	const wanted = Math.max(1, Math.round(count));

	let ordered;
	if (wanted === 1) {
		ordered = [sorted[sorted.length - 1]];
	} else if (wanted >= sorted.length) {
		ordered = sorted;
	} else {
		const stride = (sorted.length - 1) / (wanted - 1);
		ordered = Array.from({ length: wanted }, (_, i) => sorted[Math.round(i * stride)]);
	}

	const y = (value) => (1 - (value - lo) / span) * plotHeight;

	const kept = [];
	const printed = new Set();
	for (const value of ordered) {
		const label = formatCompact(value, decimals);
		// Two ticks that print the same string are one tick and a rounding error.
		if (printed.has(label)) continue;
		// Two that land within a line-height of each other are a smudge.
		if (kept.some((other) => Math.abs(y(other) - y(value)) < minGap)) continue;
		printed.add(label);
		kept.push(value);
	}

	return kept;
}

/**
 * Cut every series at the newest day any metric reported. The window reaches one
 * day past UTC-today on purpose — a Watch in Seoul files "the 4th" while UTC is
 * still on the 3rd — and that slot would otherwise put a future date on the axis.
 *
 * Trimming here rather than narrowing the query keeps the slot. Every section is
 * cut to the same length: the charts share one x domain, and a ragged right edge
 * would put the same day at four different pixels.
 */
export function trimToLatest(sections) {
	const end = latestIndex(sections) + 1;
	if (end <= 0) return sections;

	return sections.map(({ metric, series }) =>
		series.values.length <= end
			? { metric, series }
			: { metric, series: { ...series, values: series.values.slice(0, end), count: end } }
	);
}

/**
 * One number for a day, averaged over the metrics with something to say about it.
 *
 * A zero drops OUT of the average rather than scoring as one. This is the one
 * place a zero is not counted, and it deliberately disagrees with `zeroFilled` —
 * do not "fix" it to match the charts. A Watch left on the charger reads
 * identically to a day in bed, and only one of those deserves a worse ring. So a
 * rest day scores on whatever else moved, or reads "No data"; `counted` drives
 * the dial's "N of 4 metrics" caption.
 *
 * Each metric is capped at its goal: a 30 km walk banks a perfect distance
 * score, it does not pay for a day of no exercise.
 */
export function dayScore(sections, index) {
	let total = 0;
	let counted = 0;

	for (const { metric, series } of sections) {
		if (!metric.goal) continue;
		const value = valueAt(series?.values ?? [], index);
		if (value === null || value === 0) continue;
		total += Math.min(value / metric.goal, 1);
		counted++;
	}

	const of = sections.filter((s) => s.metric.goal).length;
	if (counted === 0) return { score: null, counted: 0, of };
	return { score: Math.round((total / counted) * 100), counted, of };
}

/**
 * The bands a score reads in, as one word and one colour. Kept together so
 * `scoreLabel` and `scoreTone` can never disagree.
 */
const SCORE_BANDS = [
	{ from: 85, label: 'Excellent', tone: 'excellent' },
	{ from: 65, label: 'Good', tone: 'good' },
	{ from: 40, label: 'Fair', tone: 'fair' },
	{ from: -Infinity, label: 'Light', tone: 'light' }
];

function scoreBand(score) {
	if (score === null) return { label: 'No data', tone: 'none' };
	return SCORE_BANDS.find((band) => score >= band.from);
}

/** How a score reads in one word. Bands are wide on purpose — this is a mood, not a grade. */
export function scoreLabel(score) {
	return scoreBand(score).label;
}

/** The CSS custom property the score ring is stroked with. */
export function scoreTone(score) {
	return `var(--score-${scoreBand(score).tone})`;
}

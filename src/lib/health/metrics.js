/**
 * What the /health page shows and how each number reads.
 *
 * The number is the headline, so formatting lives here rather than in the
 * component: one place decides that steps get thousands separators and distance
 * gets one decimal.
 */

import { PUBLIC_METRICS, PUBLIC_RANGES } from '$convex/lib/health.js';

/** How each metric reads. The key list itself lives in Convex, which enforces it. */
const PRESENTATION = {
	steps: { label: 'Steps', unit: '', decimals: 0 },
	restingHeartRate: { label: 'Resting heart rate', unit: 'bpm', decimals: 0 },
	activeEnergy: { label: 'Active energy', unit: 'kcal', decimals: 0 },
	exerciseMinutes: { label: 'Exercise', unit: 'min', decimals: 0 },
	distance: { label: 'Walking + running distance', unit: 'km', decimals: 1 }
};

/**
 * Metrics rendered as sections, in order. Derived from the Convex allowlist so
 * the page and the public query can't drift apart — adding a section means
 * widening what the query is permitted to serve, deliberately.
 */
export const PAGE_METRICS = PUBLIC_METRICS.map((key) => ({
	key,
	...(PRESENTATION[key] ?? { label: key, unit: '', decimals: 0 })
}));

/** Range picker steps. Kept coarse so every view hits the same Convex query cache entries. */
export const RANGES = PUBLIC_RANGES;
export const DEFAULT_RANGE = 30;

export function normalizeRange(value) {
	const days = Number(value);
	return RANGES.includes(days) ? days : DEFAULT_RANGE;
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

/** An em dash for a missing value — a gap is never dressed up as a zero. */
export function formatValue(value, decimals = 0) {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	return numberFormat(decimals).format(value);
}

const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
const longDateFormat = new Intl.DateTimeFormat('en', {
	month: 'short',
	day: 'numeric',
	year: 'numeric'
});

export function formatDay(ms) {
	return dateFormat.format(new Date(ms));
}

export function formatFullDay(ms) {
	return longDateFormat.format(new Date(ms));
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
		if (values[i] !== null && values[i] !== undefined) return i;
	}
	return -1;
}

/**
 * y-domain with a little breathing room, so a line never sits flush against the
 * top or bottom of its box. A flat series still gets a band to sit in.
 */
export function valueDomain(values) {
	let min = Infinity;
	let max = -Infinity;
	for (const value of values) {
		if (value === null || value === undefined) continue;
		if (value < min) min = value;
		if (value > max) max = value;
	}
	if (min === Infinity) return [0, 1];
	if (min === max) return [min - Math.abs(min) * 0.1 - 1, max + Math.abs(max) * 0.1 + 1];
	const pad = (max - min) * 0.12;
	return [min - pad, max + pad];
}

const WORKOUT_LABELS = {
	running: 'Running',
	walking: 'Walking',
	cycling: 'Cycling',
	hiking: 'Hiking',
	swimming: 'Swimming',
	rowing: 'Rowing',
	elliptical: 'Elliptical',
	yoga: 'Yoga',
	strength: 'Strength training',
	hiit: 'HIIT',
	other: 'Workout'
};

export function workoutLabel(type) {
	return WORKOUT_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

export function formatDuration(seconds) {
	const total = Math.round(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m`;
	return `${total}s`;
}

const PACE_SPORTS = new Set(['running', 'walking', 'hiking']);

/** Minutes per km for foot sports, km/h for wheels and water. */
export function formatPace(type, seconds, km) {
	if (!km || km <= 0 || !seconds) return null;
	if (PACE_SPORTS.has(type)) {
		const perKm = seconds / 60 / km;
		const minutes = Math.floor(perKm);
		const secs = Math.round((perKm - minutes) * 60);
		const carry = secs === 60;
		return `${minutes + (carry ? 1 : 0)}:${String(carry ? 0 : secs).padStart(2, '0')} /km`;
	}
	return `${formatValue((km / seconds) * 3600, 1)} km/h`;
}

/** The secondary line under a workout: whatever that workout actually recorded. */
export function workoutDetails(workout) {
	const parts = [formatDuration(workout.duration)];
	if (workout.distance) parts.push(`${formatValue(workout.distance, 1)} km`);
	const pace = formatPace(workout.type, workout.duration, workout.distance);
	if (pace) parts.push(pace);
	if (workout.avgHeartRate) parts.push(`${formatValue(workout.avgHeartRate)} bpm`);
	if (workout.activeEnergy) parts.push(`${formatValue(workout.activeEnergy)} kcal`);
	return parts;
}

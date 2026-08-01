/**
 * Health read paths, shared between the key-gated internal queries in
 * `convex/health.js` and the one public query that backs the live /health page.
 *
 * These take `ctx` but never the clock: bounds arrive as arguments, because a
 * query doesn't re-run when the clock moves and a time-derived bound would go
 * stale and churn the cache.
 */

import {
	HOUR_MS,
	MAX_SERIES_DAYS,
	MAX_SERIES_HOURS,
	buildDailySeries,
	buildHourlySeries,
	metricUnit,
	shiftDateKey
} from './health.js';

/** Rows scanned to answer "latest value per metric". */
const LATEST_SCAN_LIMIT = 500;

export async function readDailySeries(ctx, { metric, startDate, days, maxPoints }) {
	const span = Math.min(Math.max(1, Math.floor(days)), MAX_SERIES_DAYS);
	const endDate = shiftDateKey(startDate, span - 1);

	const rows = await ctx.db
		.query('healthDaily')
		.withIndex('by_metric_date', (q) =>
			q.eq('metric', metric).gte('date', startDate).lte('date', endDate)
		)
		.take(span);

	return buildDailySeries({
		metric,
		unit: rows[0]?.unit ?? metricUnit(metric),
		rows,
		startDate,
		days: span,
		maxPoints
	});
}

export async function readHourlySeries(ctx, { metric, startHour, hours, maxPoints }) {
	const span = Math.min(Math.max(1, Math.floor(hours)), MAX_SERIES_HOURS);

	const rows = await ctx.db
		.query('healthBuckets')
		.withIndex('by_metric_hour', (q) =>
			q
				.eq('metric', metric)
				.gte('hour', startHour)
				.lt('hour', startHour + span * HOUR_MS)
		)
		.take(span);

	return buildHourlySeries({
		metric,
		unit: rows[0]?.unit ?? metricUnit(metric),
		rows,
		startHour,
		hours: span,
		maxPoints
	});
}

export async function readWorkouts(ctx, { startMs, type, limit }) {
	const take = Math.min(Math.max(1, Math.floor(limit)), 200);

	const rows = type
		? await ctx.db
				.query('healthWorkouts')
				.withIndex('by_type_start', (q) => q.eq('type', type).gte('start', startMs))
				.order('desc')
				.take(take)
		: await ctx.db
				.query('healthWorkouts')
				.withIndex('by_start', (q) => q.gte('start', startMs))
				.order('desc')
				.take(take);

	return rows.map(serializeWorkout);
}

/**
 * Latest day row per metric. Walks `by_date` newest-first and keeps the first
 * sighting of each metric, so the scan is bounded whatever the metric set is.
 */
export async function readLatest(ctx) {
	const rows = await ctx.db
		.query('healthDaily')
		.withIndex('by_date')
		.order('desc')
		.take(LATEST_SCAN_LIMIT);

	const metrics = {};
	for (const row of rows) {
		if (metrics[row.metric]) continue;
		metrics[row.metric] = {
			value: row.value,
			unit: row.unit,
			date: row.date,
			source: row.source ?? null,
			updatedAt: row.updatedAt
		};
	}
	return { metrics, latestDate: rows[0]?.date ?? null };
}

export async function readDay(ctx, date) {
	const rows = await ctx.db
		.query('healthDaily')
		.withIndex('by_date', (q) => q.eq('date', date))
		.take(200);

	const metrics = {};
	for (const row of rows) {
		metrics[row.metric] = { value: row.value, unit: row.unit, source: row.source ?? null };
	}
	return { date, metrics };
}

export async function readSamples(ctx, { metric, startMs, endMs, limit }) {
	const take = Math.min(Math.max(1, Math.floor(limit)), 1000);

	const rows = await ctx.db
		.query('healthSamples')
		.withIndex('by_metric_time', (q) =>
			q.eq('metric', metric).gte('time', startMs).lt('time', endMs)
		)
		.order('desc')
		.take(take);

	return rows.map((row) => ({
		metric: row.metric,
		value: row.value,
		time: row.time,
		unit: row.unit,
		source: row.source ?? null
	}));
}

function serializeWorkout(row) {
	return {
		id: row._id,
		externalId: row.externalId,
		type: row.type,
		start: row.start,
		end: row.end,
		duration: row.duration,
		distance: row.distance ?? null,
		activeEnergy: row.activeEnergy ?? null,
		avgHeartRate: row.avgHeartRate ?? null,
		maxHeartRate: row.maxHeartRate ?? null,
		elevation: row.elevation ?? null,
		source: row.source ?? null
	};
}

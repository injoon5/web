/**
 * Every function here is internal. There is no `ctx.auth` identity for this data
 * and a query can't see an HTTP header, so a public `dailySeries` taking an
 * arbitrary metric would serve body fat to anyone holding the deployment URL.
 * The key-checking HTTP action in `convex/http.js` is the entry point for
 * everything; the single narrow exception is `convex/healthPublic.js`, which
 * serves only what the public /health page already renders.
 *
 * No `Date.now()` in the queries either: a query doesn't re-run when the clock
 * moves, so a time-derived bound would go stale and churn the query cache. The
 * HTTP action computes bounds at day or hour granularity and passes them in.
 */

import { v } from 'convex/values';
import { healthSample, healthWorkout } from './schema.js';
import { internalMutation, internalQuery } from './_generated/server.js';
import { internal } from './_generated/api.js';
import {
	DAY_MS,
	HOUR_MS,
	HOUR_SCAN_LIMIT,
	applyBucketDelta,
	dateKey,
	foldSamples,
	hourFloor
} from './lib/health.js';
import {
	readDailySeries,
	readDay,
	readHourlySeries,
	readLatest,
	readSamples,
	readWorkouts
} from './lib/healthReads.js';

const SAMPLE_RETENTION_DAYS = 30;
const PRUNE_BATCH = 200;

const metricInput = v.object({
	metric: v.string(),
	value: v.number(),
	unit: v.string()
});

/**
 * One mutation for the whole payload, so day rows, hour rollups and workouts
 * commit atomically. Input is already parsed and normalized by the HTTP action.
 */
export const ingest = internalMutation({
	args: {
		date: v.optional(v.string()),
		source: v.optional(v.string()),
		metrics: v.optional(v.array(metricInput)),
		samples: v.optional(v.array(healthSample)),
		workouts: v.optional(v.array(healthWorkout))
	},
	handler: async (ctx, args) => {
		const updatedAt = Date.now();
		const result = {
			date: args.date ?? null,
			metrics: 0,
			samplesReceived: args.samples?.length ?? 0,
			samplesInserted: 0,
			samplesDuplicate: 0,
			hoursSaturated: [],
			workoutsInserted: 0,
			workoutsUpdated: 0
		};

		// Day rollups — upserted on (metric, date), so the hourly Shortcut
		// overwrites today's row instead of appending to it.
		if (args.date && args.metrics?.length) {
			for (const entry of args.metrics) {
				const existing = await ctx.db
					.query('healthDaily')
					.withIndex('by_metric_date', (q) => q.eq('metric', entry.metric).eq('date', args.date))
					.first();

				const fields = {
					value: entry.value,
					unit: entry.unit,
					source: args.source,
					updatedAt
				};

				if (existing) {
					await ctx.db.patch('healthDaily', existing._id, fields);
				} else {
					await ctx.db.insert('healthDaily', {
						date: args.date,
						metric: entry.metric,
						...fields
					});
				}
				result.metrics++;
			}
		}

		if (args.samples?.length) {
			await appendSamples(ctx, args.samples, result);
		}

		if (args.workouts?.length) {
			for (const workout of args.workouts) {
				const existing = await ctx.db
					.query('healthWorkouts')
					.withIndex('by_external', (q) => q.eq('externalId', workout.externalId))
					.first();

				if (existing) {
					await ctx.db.replace('healthWorkouts', existing._id, workout);
					result.workoutsUpdated++;
				} else {
					await ctx.db.insert('healthWorkouts', workout);
					result.workoutsInserted++;
				}
			}
		}

		return result;
	}
});

/**
 * Grouped by (metric, hour) so each hour costs one range read; the samples
 * already in that hour are the dedupe set, and only genuinely new samples reach
 * the bucket. A sample counted into a bucket sum twice can never be backed out,
 * so a re-sent batch has to be a no-op, not an approximate one.
 */
async function appendSamples(ctx, samples, result) {
	const groups = new Map();
	for (const sample of samples) {
		const hour = hourFloor(sample.time);
		const key = `${sample.metric}\u0000${hour}`;
		const group = groups.get(key);
		if (group) {
			group.items.push(sample);
		} else {
			groups.set(key, { metric: sample.metric, hour, unit: sample.unit, items: [sample] });
		}
	}

	for (const group of groups.values()) {
		const existing = await ctx.db
			.query('healthSamples')
			.withIndex('by_metric_time', (q) =>
				q
					.eq('metric', group.metric)
					.gte('time', group.hour)
					.lt('time', group.hour + HOUR_MS)
			)
			.take(HOUR_SCAN_LIMIT);

		// A truncated dedupe window can't prove a sample is new, and guessing wrong
		// corrupts the bucket permanently. Skip the hour and say so in the response.
		if (existing.length >= HOUR_SCAN_LIMIT) {
			result.hoursSaturated.push({ metric: group.metric, hour: group.hour });
			continue;
		}

		const { inserts, delta } = foldSamples(
			existing.map((row) => row.time),
			group.items
		);

		result.samplesInserted += inserts.length;
		result.samplesDuplicate += group.items.length - inserts.length;
		if (!delta) continue;

		for (const sample of inserts) {
			await ctx.db.insert('healthSamples', {
				metric: sample.metric,
				value: sample.value,
				time: sample.time,
				unit: sample.unit,
				source: sample.source
			});
		}

		const bucket = await ctx.db
			.query('healthBuckets')
			.withIndex('by_metric_hour', (q) => q.eq('metric', group.metric).eq('hour', group.hour))
			.first();

		const next = applyBucketDelta(bucket, delta);
		if (bucket) {
			await ctx.db.patch('healthBuckets', bucket._id, next);
		} else {
			await ctx.db.insert('healthBuckets', {
				metric: group.metric,
				hour: group.hour,
				unit: group.unit,
				...next
			});
		}
	}
}

// Thin registrations over `lib/healthReads.js`, one metric per query: each gets
// its own read budget, and the Convex query cache keys on the arguments, so a
// shared range picker across metrics reuses cached reads.

export const dailySeries = internalQuery({
	args: {
		metric: v.string(),
		startDate: v.string(),
		days: v.number(),
		maxPoints: v.optional(v.number())
	},
	handler: (ctx, args) => readDailySeries(ctx, args)
});

export const hourlySeries = internalQuery({
	args: {
		metric: v.string(),
		startHour: v.number(),
		hours: v.number(),
		maxPoints: v.optional(v.number())
	},
	handler: (ctx, args) => readHourlySeries(ctx, args)
});

export const workouts = internalQuery({
	args: {
		startMs: v.number(),
		type: v.optional(v.string()),
		limit: v.number()
	},
	handler: (ctx, args) => readWorkouts(ctx, args)
});

export const latest = internalQuery({
	args: {},
	handler: (ctx) => readLatest(ctx)
});

export const day = internalQuery({
	args: { date: v.string() },
	handler: (ctx, args) => readDay(ctx, args.date)
});

export const samples = internalQuery({
	args: {
		metric: v.string(),
		startMs: v.number(),
		endMs: v.number(),
		limit: v.number()
	},
	handler: (ctx, args) => readSamples(ctx, args)
});

/**
 * The hour buckets they were
 * folded into stay, so intraday history survives; only the export/debug tier is
 * pruned. Batched with a self-reschedule to stay inside one transaction's write
 * budget.
 */
export const pruneSamples = internalMutation({
	args: { cutoff: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const cutoff = args.cutoff ?? Date.now() - SAMPLE_RETENTION_DAYS * DAY_MS;

		const stale = await ctx.db
			.query('healthSamples')
			.withIndex('by_time', (q) => q.lt('time', cutoff))
			.take(PRUNE_BATCH);

		for (const row of stale) {
			await ctx.db.delete('healthSamples', row._id);
		}

		if (stale.length === PRUNE_BATCH) {
			await ctx.scheduler.runAfter(0, internal.health.pruneSamples, { cutoff });
		}

		return { deleted: stale.length, cutoff, cutoffDate: dateKey(cutoff) };
	}
});

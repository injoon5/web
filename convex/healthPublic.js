/**
 * The one public health query. Everything else in this tier is internal because
 * a query cannot see an HTTP header and so cannot be gated on the API key; this
 * one serves only what /health already publishes to every visitor.
 *
 * The limits are enforced here, never by the caller: the metric list is fixed
 * (`PUBLIC_METRICS`) and cannot be widened by arguments, `days` must be one of
 * the range picker's steps, and there are no workouts, buckets or raw samples.
 *
 * `startDate` is an argument, not derived from the clock — a query does not
 * re-run when the clock moves, so a `Date.now()` bound goes stale and churns
 * the cache.
 */

import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server.js';
import { PUBLIC_METRICS, PUBLIC_RANGES, isDateKey, latestSeriesUpdate } from './lib/health.js';
import { readDailySeries } from './lib/healthReads.js';

export const page = query({
	args: {
		startDate: v.string(),
		days: v.number()
	},
	handler: async (ctx, args) => {
		if (!isDateKey(args.startDate)) {
			throw new ConvexError({ kind: 'BadRequest', message: 'startDate must be YYYY-MM-DD' });
		}
		if (!PUBLIC_RANGES.includes(args.days)) {
			throw new ConvexError({ kind: 'BadRequest', message: 'Unsupported range' });
		}

		const series = await Promise.all(
			PUBLIC_METRICS.map((metric) =>
				readDailySeries(ctx, { metric, startDate: args.startDate, days: args.days })
			)
		);

		return { series, updatedAt: latestSeriesUpdate(series) };
	}
});

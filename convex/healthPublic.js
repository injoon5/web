/**
 * The one public health query, and the reason it is allowed to exist.
 *
 * Everything else in this tier is internal because a public query can't see an
 * HTTP header, so it can't be gated on the API key. That argument does not
 * apply to the data /health already publishes: the page renders these five
 * daily metrics and this workout list to anyone who visits injoon5.com, so a
 * query that serves exactly that — and nothing else — leaks nothing.
 *
 * "Exactly that" is enforced here, not by the caller:
 *   - the metric list is fixed (`PUBLIC_METRICS`), never taken from arguments,
 *     so no one can ask this for weight or body fat;
 *   - `days` must be one of the range picker's own steps;
 *   - no hourly buckets, no raw samples, no per-metric history beyond the page.
 *
 * `startDate` is an argument rather than derived from the clock: a query doesn't
 * re-run when the clock moves, so a `Date.now()` bound would go stale and churn
 * the cache. The page passes back the window its server render already used.
 */

import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server.js';
import {
	PUBLIC_METRICS,
	PUBLIC_RANGES,
	PUBLIC_WORKOUT_LIMIT,
	dateKeyToMs,
	isDateKey
} from './lib/health.js';
import { readDailySeries, readWorkouts } from './lib/healthReads.js';

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

		const workouts = await readWorkouts(ctx, {
			startMs: dateKeyToMs(args.startDate),
			limit: PUBLIC_WORKOUT_LIMIT
		});

		return { series, workouts };
	}
});

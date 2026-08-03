import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	comments: defineTable({
		url: v.string(),
		username: v.string(),
		passwordHash: v.string(),
		text: v.string(),
		ipHash: v.string(),
		parentId: v.union(v.id('comments'), v.null()),
		depth: v.number(),
		reply: v.union(v.string(), v.null()),
		updatedAt: v.union(v.number(), v.null()),
		deletedAt: v.union(v.number(), v.null()),
		upvotes: v.optional(v.number()),
		downvotes: v.optional(v.number())
	})
		// Hard delete only sets `deletedAt`, so tombstones stay in the table
		// forever. Binding `deletedAt` too lets every public read skip them at the
		// index instead of collecting them and filtering in JS. `by_url` alone
		// would be a prefix of this one, and so redundant.
		.index('by_url_deleted', ['url', 'deletedAt'])
		.index('by_parent', ['parentId']),

	commentUrlCounts: defineTable({
		url: v.string(),
		count: v.number()
	}).index('by_url', ['url']),

	migrationMeta: defineTable({
		key: v.string(),
		complete: v.boolean()
	}).index('by_key', ['key']),

	commentVotes: defineTable({
		commentId: v.id('comments'),
		ipHash: v.string(),
		voteType: v.union(v.literal('up'), v.literal('down'))
	})
		// by_comment_ip also serves plain by-comment scans (index prefix), so a
		// separate by_comment index would be redundant.
		.index('by_comment_ip', ['commentId', 'ipHash'])
		.index('by_ip', ['ipHash']),

	likes: defineTable({
		url: v.string(),
		ipHash: v.string()
	})
		// by_url_ip also serves plain by-url scans (index prefix).
		.index('by_url_ip', ['url', 'ipHash']),

	likeCounts: defineTable({
		url: v.string(),
		count: v.number()
	}).index('by_url', ['url']),

	bannedIps: defineTable({
		ipHash: v.string(),
		reason: v.union(v.string(), v.null())
	}).index('by_ip', ['ipHash']),

	nowPage: defineTable({
		content: v.string(),
		updatedAt: v.number()
	}),

	// ---------------------------------------------------------------------------
	// Home-page feeds
	//
	// One row each, overwritten by the 5-minute cron. Normalized down to what the
	// page renders (see convex/lib/feeds.js) — the upstream payloads carry four
	// image sizes, EXIF and mbids the home page never touches.
	// ---------------------------------------------------------------------------

	nowPlaying: defineTable({
		tracks: v.array(
			v.object({
				name: v.string(),
				artist: v.string(),
				url: v.string(),
				image: v.string(),
				nowPlaying: v.boolean(),
				playedAt: v.union(v.number(), v.null()) // null while the track is playing
			})
		),
		updatedAt: v.number()
	}),

	photos: defineTable({
		photos: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				url: v.string(),
				image: v.string(),
				takenAt: v.string() // the feed's own formatted, timezone-naive capture time
			})
		),
		updatedAt: v.number()
	}),

	// ---------------------------------------------------------------------------
	// Apple Health
	//
	// Three tiers of the same data, so a read touches about as many rows as the
	// chart plots points: day rollups for multi-day charts, hour buckets for
	// intraday, raw samples only for export/debug (pruned at 30 days).
	// ---------------------------------------------------------------------------

	// One row per (metric, date). The hourly Shortcut re-sends the whole day, so
	// this is upserted rather than appended.
	healthDaily: defineTable({
		date: v.string(), // YYYY-MM-DD — sorts lexicographically, so no numeric twin
		metric: v.string(),
		value: v.number(),
		unit: v.string(),
		source: v.optional(v.string()),
		updatedAt: v.number()
	})
		.index('by_metric_date', ['metric', 'date'])
		.index('by_date', ['date']),

	// Hourly rollup of `healthSamples`. Stores the components rather than an
	// average: a mean can't be re-averaged without weights, and min/max gives
	// intraday charts a range band.
	healthBuckets: defineTable({
		metric: v.string(),
		hour: v.number(), // epoch ms floored to the hour
		count: v.number(),
		sum: v.number(),
		min: v.number(),
		max: v.number(),
		unit: v.string()
	})
		.index('by_metric_hour', ['metric', 'hour'])
		.index('by_hour', ['hour']),

	healthSamples: defineTable({
		metric: v.string(),
		value: v.number(),
		time: v.number(),
		unit: v.string(),
		source: v.optional(v.string())
	})
		.index('by_metric_time', ['metric', 'time'])
		.index('by_time', ['time']),

	// Workouts are events, not a time series — a handful a day at most, always
	// read as a list or a per-type history — so `by_start` / `by_type_start`
	// range scans are already proportional to what renders. No rollup tier.
	healthWorkouts: defineTable({
		externalId: v.string(), // `${type}:${startMs}` — Shortcuts exposes no workout UUID
		type: v.string(),
		start: v.number(),
		end: v.number(),
		duration: v.number(), // seconds
		distance: v.optional(v.number()),
		activeEnergy: v.optional(v.number()),
		avgHeartRate: v.optional(v.number()),
		maxHeartRate: v.optional(v.number()),
		elevation: v.optional(v.number()),
		source: v.optional(v.string())
	})
		.index('by_start', ['start'])
		.index('by_type_start', ['type', 'start'])
		.index('by_external', ['externalId'])
});

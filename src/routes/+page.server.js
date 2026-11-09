// Incremental Static Regeneration, not a build-time prerender: the lists are
// build-time constant, but Now Listening and Photos change, and a prerendered
// home page could only show their skeletons until the Convex websocket (in the
// US) had answered. Regenerated at most every 5 minutes, in the background —
// visitors always get a cached page — and the feeds' own cron runs on the same
// cadence. Measured against Vercel's limits: at most ~8,640 regenerations a
// month, and an unchanged page costs no ISR write at all (Hobby includes 200k).
//
// The page still subscribes, seeded with this data, so a newer track replaces
// the baked-in one without a reload.
export const config = { isr: { expiration: 300 } };

import { publishedPosts, publishedProjects } from '#lib/server/content.js';
import { queryOrNull } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';

export const load = async () => {
	const [nowPlaying, photos] = await Promise.all([
		queryOrNull(api.feeds.nowPlaying),
		queryOrNull(api.feeds.photos)
	]);
	return {
		posts: publishedPosts(),
		projects: publishedProjects(),
		nowPlaying,
		photos
	};
};

import { cronJobs } from 'convex/server';
import { internal } from './_generated/api.js';

const crons = cronJobs();

crons.interval(
	'sync homepage now playing',
	{ minutes: 1 },
	internal.homeFeed.syncNowPlaying,
	{}
);

crons.interval('sync homepage photos', { hours: 1 }, internal.homeFeed.syncPhotos, {});

export default crons;

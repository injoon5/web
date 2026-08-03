import { cronJobs } from 'convex/server';
import { internal } from './_generated/api.js';

const crons = cronJobs();

// Raw health samples are the export/debug tier only — the hour buckets they were
// folded into outlive them, so a 30-day window is enough.
crons.interval('prune health samples', { hours: 24 }, internal.health.pruneSamples, {});

// Home-page feeds. Five minutes matches what the GitHub Action these replaced
// ran at, and stays well inside Last.fm's rate limit for a single user.
crons.interval('refresh now playing', { minutes: 5 }, internal.feeds.refreshNowPlaying, {});
crons.interval('refresh photos', { minutes: 5 }, internal.feeds.refreshPhotos, {});

export default crons;

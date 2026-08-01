import { cronJobs } from 'convex/server';
import { internal } from './_generated/api.js';

const crons = cronJobs();

// Raw health samples are the export/debug tier only — the hour buckets they were
// folded into outlive them, so a 30-day window is enough.
crons.interval('prune health samples', { hours: 24 }, internal.health.pruneSamples, {});

export default crons;

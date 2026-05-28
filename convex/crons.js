import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval('refresh now playing', { minutes: 1 }, internal.media.refreshNowPlaying, {});
crons.interval('refresh photos', { hours: 1 }, internal.media.refreshPhotos, {});

export default crons;

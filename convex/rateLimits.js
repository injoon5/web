import { RateLimiter, MINUTE } from '@convex-dev/rate-limiter';
import { components } from './_generated/api.js';

export const limiter = new RateLimiter(components.rateLimiter, {
	comment: { kind: 'token bucket', rate: 10, period: MINUTE, capacity: 10 },
	vote: { kind: 'token bucket', rate: 60, period: MINUTE, capacity: 60 },
	like: { kind: 'token bucket', rate: 60, period: MINUTE, capacity: 60 },
	edit: { kind: 'token bucket', rate: 10, period: MINUTE, capacity: 10 }
});

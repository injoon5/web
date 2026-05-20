import { RateLimiter, MINUTE } from '@convex-dev/rate-limiter';
import { components } from './_generated/api.js';

export const limiter = new RateLimiter(components.rateLimiter, {
	comment: { kind: 'token bucket', rate: 3, period: 10 * MINUTE, capacity: 3 },
	vote: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 30 },
	like: { kind: 'token bucket', rate: 10, period: MINUTE, capacity: 10 },
	edit: { kind: 'token bucket', rate: 5, period: 10 * MINUTE, capacity: 5 }
});

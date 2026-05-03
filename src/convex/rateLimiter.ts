import { RateLimiter, MINUTE } from '@convex-dev/rate-limiter';
import { components } from './_generated/api';

export const rateLimiter = new RateLimiter(components.rateLimiter, {
	// 3 comments per IP per 10 minutes
	comment: { kind: 'token bucket', rate: 3, period: 10 * MINUTE },
	// 30 votes per IP per minute
	vote: { kind: 'token bucket', rate: 30, period: MINUTE },
	// 10 likes per IP per minute
	like: { kind: 'token bucket', rate: 10, period: MINUTE },
	// 5 edits/deletes per IP per 10 minutes
	edit: { kind: 'token bucket', rate: 5, period: 10 * MINUTE }
});

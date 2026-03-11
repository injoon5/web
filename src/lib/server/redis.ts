import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { env } from '$env/dynamic/private';

export const redis = new Redis({
	url: env.UPSTASH_REDIS_REST_URL,
	token: env.UPSTASH_REDIS_REST_TOKEN
});

// 3 comments per 10 minutes per IP
export const commentRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(3, '10 m'),
	prefix: 'rl:comment',
	analytics: true
});

// 30 votes per minute per IP
export const voteRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(30, '1 m'),
	prefix: 'rl:vote',
	analytics: true
});

// 10 likes per minute per IP
export const likeRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(10, '1 m'),
	prefix: 'rl:like',
	analytics: true
});

// 5 edits per 10 minutes per IP
export const editRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, '10 m'),
	prefix: 'rl:edit',
	analytics: true
});

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from '$env/static/private';

export const redis = new Redis({
	url: UPSTASH_REDIS_REST_URL,
	token: UPSTASH_REDIS_REST_TOKEN
});

// 5 comments per 10 minutes per IP
export const commentRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, '10 m'),
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

// 20 likes per minute per IP
export const likeRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(20, '1 m'),
	prefix: 'rl:like',
	analytics: true
});

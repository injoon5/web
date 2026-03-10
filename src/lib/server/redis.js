import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from '$env/static/private';

export const redis = new Redis({
	url: UPSTASH_REDIS_REST_URL,
	token: UPSTASH_REDIS_REST_TOKEN
});

export const commentRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(3, '10 m'),
	prefix: 'rl:comment',
	analytics: true
});

export const voteRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(30, '1 m'),
	prefix: 'rl:vote',
	analytics: true
});

export const likeRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(10, '1 m'),
	prefix: 'rl:like',
	analytics: true
});

export const editRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, '10 m'),
	prefix: 'rl:edit',
	analytics: true
});

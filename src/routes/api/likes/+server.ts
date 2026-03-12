import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex, api } from '$lib/server/convex.js';
import { likeRatelimit } from '$lib/server/redis';
import { getClientIp, hashIp } from '$lib/server/ip';
import { likeSchema } from '$lib/server/validation';

export const GET: RequestHandler = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');

	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const result = await convex.query(api.likes.getLikes, { url: pageUrl, ipHash });

	return json({ count: result.count, liked: result.liked });
};

export const POST: RequestHandler = async ({ request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	// Check if IP is banned
	const isBanned = await convex.query(api.bans.checkBan, { ipHash });
	if (isBanned) throw error(403, 'You have been banned');

	// Rate limit
	const { success } = await likeRatelimit.limit(ipHash);
	if (!success) throw error(429, 'Too many requests. Please slow down.');

	const raw = await request.json();
	const parsed = likeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Missing url');
	const { url: pageUrl } = parsed.data;

	const result = await convex.mutation(api.likes.toggleLike, { url: pageUrl, ipHash });

	return json({ count: result.count, liked: result.liked });
};

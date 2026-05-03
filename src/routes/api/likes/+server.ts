import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '../../../convex/_generated/api';
import { likeRatelimit } from '$lib/server/redis';
import { getClientIp, hashIp } from '$lib/server/ip';
import { likeSchema } from '$lib/server/validation';
import { isValidPageUrl } from '$lib/server/valid-urls';

export const GET: RequestHandler = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');

	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const result = await convex.query(api.likes.getLikes, { url: pageUrl, ipHash });
	return json(result);
};

export const POST: RequestHandler = async ({ request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const { success } = await likeRatelimit.limit(ipHash);
	if (!success) throw error(429, 'Too many requests. Please slow down.');

	const raw = await request.json();
	const parsed = likeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Missing url');
	const { url: pageUrl } = parsed.data;

	if (!isValidPageUrl(pageUrl)) throw error(404, 'Page not found');

	const result = await convex.mutation(api.likes.toggleLike, { url: pageUrl, ipHash });
	return json(result);
};

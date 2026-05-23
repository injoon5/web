import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClientIp, hashIp } from '$lib/server/ip';

export const GET: RequestHandler = ({ request }) => {
	return json({ ipHash: hashIp(getClientIp(request)) });
};

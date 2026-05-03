import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '../../../../../convex/_generated/api';
import { voteRatelimit } from '$lib/server/redis';
import { getClientIp, hashIp } from '$lib/server/ip';
import { voteSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';

export const POST: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	if (!verifyAdminSecret(request)) {
		const { success } = await voteRatelimit.limit(ipHash);
		if (!success) throw error(429, 'Too many votes. Please slow down.');
	}

	const { id: commentId } = params;
	const raw = await request.json();
	const parsed = voteSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid vote type');
	const { voteType } = parsed.data;

	const result = await convex.mutation(api.votes.voteOnComment, { commentId, ipHash, voteType });
	return json(result);
};

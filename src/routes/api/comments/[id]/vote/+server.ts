import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex, api } from '$lib/server/convex.js';
import { voteRatelimit } from '$lib/server/redis';
import { getClientIp, hashIp } from '$lib/server/ip';
import { voteSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';

export const POST: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	// Ban check
	const isBanned = await convex.query(api.bans.checkBan, { ipHash });
	if (isBanned) throw error(403, 'You have been banned');

	// Rate limit (skipped for admin)
	if (!verifyAdminSecret(request)) {
		const { success } = await voteRatelimit.limit(ipHash);
		if (!success) throw error(429, 'Too many votes. Please slow down.');
	}

	const { id: commentId } = params;
	const raw = await request.json();
	const parsed = voteSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid vote type');
	const { voteType } = parsed.data;

	let result;
	try {
		result = await convex.mutation(api.votes.toggleVote, { commentId, ipHash, voteType });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : '';
		if (msg.includes('not found') || msg.includes('Not Found')) throw error(404, 'Comment not found');
		throw error(500, 'Failed to register vote');
	}

	return json({ upvotes: result.upvotes, downvotes: result.downvotes, myVote: result.myVote });
};

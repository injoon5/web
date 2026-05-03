import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '../../../../../convex/_generated/api';
import { getClientIp, hashIp } from '$lib/server/ip';
import { voteSchema } from '$lib/server/validation';
import { handleConvexError } from '$lib/server/convexError';

export const POST: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const { id: commentId } = params;
	const raw = await request.json();
	const parsed = voteSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid vote type');
	const { voteType } = parsed.data;

	try {
		const result = await convex.mutation(api.votes.voteOnComment, { commentId, ipHash, voteType });
		return json(result);
	} catch (err) {
		return handleConvexError(err, 'Too many votes. Please slow down.');
	}
};

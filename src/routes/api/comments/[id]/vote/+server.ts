import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { getClientIp, hashIp } from '$lib/server/ip';
import { voteSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';
import { convexErrorToResponse } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ params, request }) => {
	const { id } = params;
	if (!id) throw error(400, 'Missing comment id');

	const ipHash = hashIp(getClientIp(request));
	const admin = verifyAdminSecret(request);

	let raw;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	const parsed = voteSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid vote type');

	try {
		const result = await convex.mutation(api.comments.vote, {
			commentId: id,
			voteType: parsed.data.voteType,
			ipHash,
			adminSecret: admin ? ADMIN_SECRET : undefined
		});
		return json(result);
	} catch (err) {
		const mapped = convexErrorToResponse(err);
		if (mapped instanceof Response) return mapped;
		throw mapped;
	}
};

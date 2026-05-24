import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { getClientIp, hashIp } from '$lib/server/ip';
import { voteSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';
import { runConvex } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ params, request }) => {
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

	return runConvex(() =>
		convex.mutation(api.comments.vote, {
			commentId: params.id,
			voteType: parsed.data.voteType,
			ipHash,
			serverSecret: ADMIN_SECRET,
			adminSecret: admin ? ADMIN_SECRET : undefined
		})
	);
};

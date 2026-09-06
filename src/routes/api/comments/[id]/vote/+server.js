import { error } from '@sveltejs/kit';
import { convex, backendSecret } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { requestIpHash } from '$lib/server/ip.js';
import { voteSchema, parseConvexId } from '$lib/server/validation.js';
import { verifyAdminSecret } from '$lib/server/admin.js';
import { runConvex, parseBody } from '$lib/server/api.js';
import { ADMIN_SECRET } from '$env/static/private';

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ params, request }) => {
	const ipHash = requestIpHash(request);
	const admin = verifyAdminSecret(request);
	const commentId = parseConvexId(params.id);
	if (!commentId) throw error(400, 'Invalid comment id');
	const { voteType } = await parseBody(request, voteSchema);

	return runConvex(() =>
		convex.mutation(api.comments.vote, {
			commentId,
			voteType,
			ipHash,
			backendSecret,
			adminSecret: admin ? ADMIN_SECRET : undefined
		})
	);
};

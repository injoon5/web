import type { RequestHandler } from './$types';
import type { Id } from '$convex/_generated/dataModel';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { requestIpHash } from '$lib/server/ip';
import { voteSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';
import { runConvex, parseBody } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ params, request }) => {
	const ipHash = requestIpHash(request);
	const admin = verifyAdminSecret(request);
	const { voteType } = await parseBody(request, voteSchema);

	return runConvex(() =>
		convex.mutation(api.comments.vote, {
			commentId: params.id as Id<'comments'>,
			voteType,
			ipHash,
			adminSecret: admin ? ADMIN_SECRET : undefined
		})
	);
};

import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { requestIpHash } from '$lib/server/ip.js';
import { voteSchema } from '$lib/server/validation.js';
import { verifyAdminSecret } from '$lib/server/admin.js';
import { runConvex, parseBody } from '$lib/server/api.js';
import { ADMIN_SECRET } from '$env/static/private';

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ params, request }) => {
	const ipHash = requestIpHash(request);
	const admin = verifyAdminSecret(request);
	const { voteType } = await parseBody(request, voteSchema);

	return runConvex(() =>
		convex.mutation(api.comments.vote, {
			commentId: /** @type {import('$convex/_generated/dataModel').Id<'comments'>} */ (params.id),
			voteType,
			ipHash,
			adminSecret: admin ? ADMIN_SECRET : undefined
		})
	);
};

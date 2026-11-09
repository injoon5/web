import { convex } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import { visitorArgs } from '#lib/server/callers.js';
import { voteSchema, requireConvexId } from '#lib/server/validation.js';
import { runConvex, parseBody } from '#lib/server/api.js';

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ params, request }) => {
	const visitor = visitorArgs(request);
	const commentId = requireConvexId(params.id);
	const { voteType } = await parseBody(request, voteSchema);

	// `ipHash` rides back for the same reason as /api/likes: see `adoptIpHash`.
	return runConvex(
		() => convex.mutation(api.comments.vote, { commentId, voteType, ...visitor }),
		(data) => Response.json({ ...data, ipHash: visitor.ipHash })
	);
};

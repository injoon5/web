import { convex } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import { adminArgs } from '#lib/server/callers.js';
import { replySchema, requireConvexId } from '#lib/server/validation.js';
import { runConvex, parseBody } from '#lib/server/api.js';

const success = () => Response.json({ success: true });

/** @type {import('./$types').RequestHandler} */
export const DELETE = async ({ params, request, url }) => {
	const admin = adminArgs(request);
	const commentId = requireConvexId(params.id);
	const remove =
		url.searchParams.get('soft') === '1' ? api.comments.adminSoftDelete : api.comments.hardDelete;
	return runConvex(() => convex.mutation(remove, { commentId, ...admin }), success);
};

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ params, request }) => {
	const admin = adminArgs(request);
	const commentId = requireConvexId(params.id);
	const { reply } = await parseBody(request, replySchema);
	return runConvex(
		() => convex.mutation(api.comments.setReply, { commentId, reply, ...admin }),
		success
	);
};

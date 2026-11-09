import { convex } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import { adminArgs } from '#lib/server/callers.js';
import { requireConvexId } from '#lib/server/validation.js';
import { runConvex } from '#lib/server/api.js';

/** @type {import('./$types').RequestHandler} */
export const DELETE = async ({ params, request }) => {
	const admin = adminArgs(request);
	const banId = requireConvexId(params.id);
	return runConvex(
		() => convex.mutation(api.bans.remove, { banId, ...admin }),
		() => Response.json({ success: true })
	);
};

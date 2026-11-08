import { convex } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import { adminArgs } from '#lib/server/callers.js';
import { banSchema } from '#lib/server/validation.js';
import { runConvex, parseBody } from '#lib/server/api.js';

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ request }) => {
	const admin = adminArgs(request);
	return runConvex(
		() => convex.query(api.bans.list, admin),
		(bans) => Response.json({ bans })
	);
};

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request }) => {
	const admin = adminArgs(request);
	const { commentId, reason } = await parseBody(request, banSchema);
	return runConvex(
		() => convex.mutation(api.bans.create, { commentId, reason, ...admin }),
		(ban) => Response.json({ ban }, { status: 201 })
	);
};

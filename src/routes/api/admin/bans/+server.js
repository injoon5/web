import { json } from '@sveltejs/kit';
import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { requireAdmin } from '$lib/server/admin.js';
import { banSchema } from '$lib/server/validation.js';
import { runConvex, parseBody } from '$lib/server/api.js';
import { ADMIN_SECRET } from '$env/static/private';

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ request }) => {
	requireAdmin(request);
	return runConvex(
		() => convex.query(api.bans.list, { adminSecret: ADMIN_SECRET }),
		(bans) => json({ bans })
	);
};

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request }) => {
	requireAdmin(request);
	const { commentId, reason } = await parseBody(request, banSchema);

	return runConvex(
		() => convex.mutation(api.bans.create, { commentId, reason, adminSecret: ADMIN_SECRET }),
		(ban) => json({ ban }, { status: 201 })
	);
};

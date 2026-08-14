import { json, error } from '@sveltejs/kit';
import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { requireAdmin } from '$lib/server/admin.js';
import { parseConvexId } from '$lib/server/validation.js';
import { runConvex } from '$lib/server/api.js';
import { ADMIN_SECRET } from '$env/static/private';

/** @type {import('./$types').RequestHandler} */
export const DELETE = async ({ params, request }) => {
	requireAdmin(request);
	const banId = parseConvexId(params.id);
	if (!banId) throw error(400, 'Invalid ban id');
	return runConvex(
		() =>
			convex.mutation(api.bans.remove, {
				banId,
				adminSecret: ADMIN_SECRET
			}),
		() => json({ success: true })
	);
};

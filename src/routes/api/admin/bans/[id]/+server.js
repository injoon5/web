import { json } from '@sveltejs/kit';
import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { requireAdmin } from '$lib/server/admin.js';
import { runConvex } from '$lib/server/api.js';
import { ADMIN_SECRET } from '$env/static/private';

/** @type {import('./$types').RequestHandler} */
export const DELETE = async ({ params, request }) => {
	requireAdmin(request);
	return runConvex(
		() =>
			convex.mutation(api.bans.remove, {
				banId: /** @type {import('$convex/_generated/dataModel').Id<'bannedIps'>} */ (params.id),
				adminSecret: ADMIN_SECRET
			}),
		() => json({ success: true })
	);
};

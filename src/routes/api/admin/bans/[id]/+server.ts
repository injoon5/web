import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { requireAdmin } from '$lib/server/admin';
import { runConvex } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const DELETE: RequestHandler = async ({ params, request }) => {
	requireAdmin(request);
	return runConvex(
		() => convex.mutation(api.bans.remove, { banId: params.id, adminSecret: ADMIN_SECRET }),
		() => json({ success: true })
	);
};

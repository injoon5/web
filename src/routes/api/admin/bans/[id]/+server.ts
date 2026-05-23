import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { runConvex } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const DELETE: RequestHandler = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');
	return runConvex(
		() => convex.mutation(api.bans.remove, { banId: params.id, adminSecret: ADMIN_SECRET }),
		() => json({ success: true })
	);
};

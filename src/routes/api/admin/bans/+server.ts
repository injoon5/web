import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { requireAdmin } from '$lib/server/admin';
import { banSchema } from '$lib/server/validation';
import { runConvex, parseBody } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ request }) => {
	requireAdmin(request);
	return runConvex(
		() => convex.query(api.bans.list, { adminSecret: ADMIN_SECRET }),
		(bans) => json({ bans })
	);
};

export const POST: RequestHandler = async ({ request }) => {
	requireAdmin(request);
	const { commentId, reason } = await parseBody(request, banSchema);

	return runConvex(
		() => convex.mutation(api.bans.create, { commentId, reason, adminSecret: ADMIN_SECRET }),
		(ban) => json({ ban }, { status: 201 })
	);
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { banSchema } from '$lib/server/validation';
import { runConvex } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');
	return runConvex(
		() => convex.query(api.bans.list, { adminSecret: ADMIN_SECRET }),
		(bans) => json({ bans })
	);
};

export const POST: RequestHandler = async ({ request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	let raw;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	const parsed = banSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');
	const { commentId, reason } = parsed.data;

	return runConvex(
		() => convex.mutation(api.bans.create, { commentId, reason, adminSecret: ADMIN_SECRET }),
		(ban) => json({ ban }, { status: 201 })
	);
};

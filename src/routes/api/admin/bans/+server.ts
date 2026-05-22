import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { banSchema } from '$lib/server/validation';
import { convexErrorToResponse } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	try {
		const bans = await convex.query(api.bans.list, { adminSecret: ADMIN_SECRET });
		return json({ bans });
	} catch (err) {
		const mapped = convexErrorToResponse(err);
		if (mapped instanceof Response) return mapped;
		throw mapped;
	}
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

	try {
		const ban = await convex.mutation(api.bans.create, {
			commentId,
			reason,
			adminSecret: ADMIN_SECRET
		});
		return json({ ban }, { status: 201 });
	} catch (err) {
		const mapped = convexErrorToResponse(err);
		if (mapped instanceof Response) return mapped;
		throw mapped;
	}
};

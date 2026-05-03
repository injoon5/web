import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '../../../../convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { banSchema } from '$lib/server/validation';

export const GET: RequestHandler = async ({ request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const bans = await convex.query(api.bans.getBans, {});
	return json({ bans });
};

export const POST: RequestHandler = async ({ request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const raw = await request.json();
	const parsed = banSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');

	const ban = await convex.mutation(api.bans.banByCommentId, {
		commentId: parsed.data.commentId,
		reason: parsed.data.reason
	});

	return json({ ban }, { status: 201 });
};

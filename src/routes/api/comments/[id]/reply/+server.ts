import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex, api } from '$lib/server/convex.js';
import { verifyAdminSecret } from '$lib/server/admin';

// POST /api/comments/[id]/reply - Admin reply (legacy route)
export const POST: RequestHandler = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const { id } = params;
	const body = await request.json();
	const { reply } = body;

	if (typeof reply !== 'string') throw error(400, 'Reply must be a string');

	await convex.mutation(api.comments.setReply, {
		id,
		reply: reply.trim() || undefined
	});

	return json({ success: true });
};

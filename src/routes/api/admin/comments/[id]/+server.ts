import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex, api } from '$lib/server/convex.js';
import { verifyAdminSecret } from '$lib/server/admin';

export const DELETE: RequestHandler = async ({ params, request, url }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	if (url.searchParams.get('soft') === '1') {
		await convex.mutation(api.comments.adminSoftDelete, { id: params.id });
	} else {
		await convex.mutation(api.comments.hardDelete, { id: params.id });
	}

	return json({ success: true });
};

export const POST: RequestHandler = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { reply } = body;

	if (typeof reply !== 'string') throw error(400, 'Reply must be a string');

	await convex.mutation(api.comments.setReply, {
		id: params.id,
		reply: reply.trim() || undefined
	});

	return json({ success: true });
};

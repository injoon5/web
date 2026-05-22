import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { replySchema } from '$lib/server/validation';
import { convexErrorToResponse } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const DELETE: RequestHandler = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');
	const { id } = params;
	if (!id) throw error(400, 'Missing comment id');

	try {
		await convex.mutation(api.comments.hardDelete, {
			commentId: id,
			adminSecret: ADMIN_SECRET
		});
		return json({ success: true });
	} catch (err) {
		const mapped = convexErrorToResponse(err);
		if (mapped instanceof Response) return mapped;
		throw mapped;
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');
	const { id } = params;
	if (!id) throw error(400, 'Missing comment id');

	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	const parsed = replySchema.safeParse(body);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid reply');

	try {
		await convex.mutation(api.comments.setReply, {
			commentId: id,
			reply: parsed.data.reply,
			adminSecret: ADMIN_SECRET
		});
		return json({ success: true });
	} catch (err) {
		const mapped = convexErrorToResponse(err);
		if (mapped instanceof Response) return mapped;
		throw mapped;
	}
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { replySchema } from '$lib/server/validation';
import { runConvex } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const DELETE: RequestHandler = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');
	return runConvex(
		() => convex.mutation(api.comments.hardDelete, { commentId: params.id, adminSecret: ADMIN_SECRET }),
		() => json({ success: true })
	);
};

export const POST: RequestHandler = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	const parsed = replySchema.safeParse(body);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid reply');

	return runConvex(
		() =>
			convex.mutation(api.comments.setReply, {
				commentId: params.id,
				reply: parsed.data.reply,
				adminSecret: ADMIN_SECRET
			}),
		() => json({ success: true })
	);
};

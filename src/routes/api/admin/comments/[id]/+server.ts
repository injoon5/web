import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '../../../../../convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { replySchema } from '$lib/server/validation';

export const DELETE: RequestHandler = async ({ params, request, url }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	if (url.searchParams.get('soft') === '1') {
		await convex.mutation(api.comments.softDeleteComment, { id: params.id });
	} else {
		await convex.mutation(api.comments.hardDeleteComment, { id: params.id });
	}

	return json({ success: true });
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

	await convex.mutation(api.comments.setAdminReply, {
		id: params.id,
		reply: parsed.data.reply.trim() || undefined
	});

	return json({ success: true });
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { comments } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminSecret } from '$lib/server/admin';

export const DELETE: RequestHandler = async ({ params, request, url }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	if (url.searchParams.get('soft') === '1') {
		await db
			.update(comments)
			.set({ text: '[deleted]', username: '[deleted]' })
			.where(eq(comments.id, params.id));
	} else {
		await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, params.id));
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
	const { reply } = body;

	if (typeof reply !== 'string') throw error(400, 'Reply must be a string');

	await db
		.update(comments)
		.set({ reply: reply.trim() || null })
		.where(eq(comments.id, params.id));

	return json({ success: true });
};

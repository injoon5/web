import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { comments } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminSecret } from '$lib/server/admin';
import { replySchema } from '$lib/server/validation';

// POST /api/comments/[id]/reply - Admin reply
export const POST: RequestHandler = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const { id } = params;
	const body = await request.json();
	const parsed = replySchema.safeParse(body);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid reply');

	await db
		.update(comments)
		.set({ reply: parsed.data.reply.trim() || null })
		.where(eq(comments.id, id));

	return json({ success: true });
};

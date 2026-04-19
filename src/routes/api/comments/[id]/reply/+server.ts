import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { verifyAdminSecret } from '$lib/server/admin';
import { replySchema } from '$lib/server/validation';

// POST /api/comments/[id]/reply - Admin reply (legacy; prefer /api/admin/comments/[id])
export const POST = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const { id } = params;
	const body = await request.json();
	const parsed = replySchema.safeParse(body);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid reply');

	await db.transact(db.tx.comments[id].update({ reply: parsed.data.reply.trim() || null }));

	return json({ success: true });
};

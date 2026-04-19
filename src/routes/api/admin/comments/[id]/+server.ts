import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { verifyAdminSecret } from '$lib/server/admin';
import { replySchema } from '$lib/server/validation';

export const DELETE = async ({ params, request, url }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const now = new Date().toISOString();

	if (url.searchParams.get('soft') === '1') {
		await db.transact(
			db.tx.comments[params.id].update({ text: '[deleted]', username: '[deleted]', updatedAt: now })
		);
	} else {
		await db.transact(db.tx.comments[params.id].update({ deletedAt: now }));
	}

	return json({ success: true });
};

export const POST = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	const parsed = replySchema.safeParse(body);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid reply');

	const replyText = parsed.data.reply.trim() || null;
	await db.transact(db.tx.comments[params.id].update({ reply: replyText }));

	return json({ success: true });
};

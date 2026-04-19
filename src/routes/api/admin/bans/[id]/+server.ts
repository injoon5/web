import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { verifyAdminSecret } from '$lib/server/admin';

export const DELETE = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	await db.transact(db.tx.bannedIps[params.id].delete());

	return json({ success: true });
};

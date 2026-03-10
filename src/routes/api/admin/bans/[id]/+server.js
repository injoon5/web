import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { bannedIps } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { verifyAdminSecret } from '$lib/server/admin';

export const DELETE = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	await db.delete(bannedIps).where(eq(bannedIps.id, params.id));

	return json({ success: true });
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { bannedIps } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminSecret } from '$lib/server/admin';

export const DELETE: RequestHandler = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	await db.delete(bannedIps).where(eq(bannedIps.id, params.id));

	return json({ success: true });
};

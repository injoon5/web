import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '../../../../../convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';

export const DELETE: RequestHandler = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	await convex.mutation(api.bans.deleteBan, { id: params.id });
	return json({ success: true });
};

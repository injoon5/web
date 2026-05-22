import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { convexErrorToResponse } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const DELETE: RequestHandler = async ({ params, request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');
	const { id } = params;
	if (!id) throw error(400, 'Missing ban id');

	try {
		await convex.mutation(api.bans.remove, { banId: id, adminSecret: ADMIN_SECRET });
		return json({ success: true });
	} catch (err) {
		const mapped = convexErrorToResponse(err);
		if (mapped instanceof Response) return mapped;
		throw mapped;
	}
};

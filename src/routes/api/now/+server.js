import { json, error } from '@sveltejs/kit';
import { ADMIN_SECRET } from '$env/static/private';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';

export async function POST({ request, cookies }) {
	const token = cookies.get('admin_token');
	if (!ADMIN_SECRET || token !== ADMIN_SECRET) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body.content !== 'string') {
		throw error(400, 'Missing content');
	}

	await convex.mutation(api.now.update, { content: body.content, adminSecret: ADMIN_SECRET });
	return json({ ok: true });
}

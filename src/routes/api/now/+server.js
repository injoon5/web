import { json } from '@sveltejs/kit';
import { ADMIN_SECRET } from '$env/static/private';
import { requireAdmin } from '$lib/server/admin.js';
import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { nowSchema } from '$lib/server/validation.js';
import { parseBody, runConvex } from '$lib/server/api.js';

export async function POST({ request }) {
	// Use the shared header-or-cookie admin check (consistent with every other
	// admin route), validate the body, and map Convex errors to HTTP responses.
	requireAdmin(request);

	const { content } = await parseBody(request, nowSchema);

	return runConvex(
		() => convex.mutation(api.now.update, { content, adminSecret: ADMIN_SECRET }),
		() => json({ ok: true })
	);
}

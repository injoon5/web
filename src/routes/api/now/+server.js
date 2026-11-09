import { convex } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import { adminArgs } from '#lib/server/callers.js';
import { nowSchema } from '#lib/server/validation.js';
import { parseBody, runConvex } from '#lib/server/api.js';

export async function POST({ request }) {
	const admin = adminArgs(request);
	const { content } = await parseBody(request, nowSchema);
	return runConvex(
		() => convex.mutation(api.now.update, { content, ...admin }),
		() => Response.json({ ok: true })
	);
}

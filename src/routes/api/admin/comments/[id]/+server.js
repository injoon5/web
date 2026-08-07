import { json } from '@sveltejs/kit';
import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { requireAdmin } from '$lib/server/admin.js';
import { replySchema } from '$lib/server/validation.js';
import { runConvex, parseBody } from '$lib/server/api.js';
import { ADMIN_SECRET } from '$env/static/private';

/** @type {import('./$types').RequestHandler} */
export const DELETE = async ({ params, request, url }) => {
	requireAdmin(request);

	if (url.searchParams.get('soft') === '1') {
		return runConvex(
			() =>
				convex.action(api.commentActions.softDeleteComment, {
					commentId: /** @type {import('$convex/_generated/dataModel').Id<'comments'>} */ (
						params.id
					),
					ipHash: '',
					adminSecret: ADMIN_SECRET
				}),
			() => json({ success: true })
		);
	}

	return runConvex(
		() =>
			convex.mutation(api.comments.hardDelete, {
				commentId: /** @type {import('$convex/_generated/dataModel').Id<'comments'>} */ (params.id),
				adminSecret: ADMIN_SECRET
			}),
		() => json({ success: true })
	);
};

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ params, request }) => {
	requireAdmin(request);
	const { reply } = await parseBody(request, replySchema);

	return runConvex(
		() =>
			convex.mutation(api.comments.setReply, {
				commentId: /** @type {import('$convex/_generated/dataModel').Id<'comments'>} */ (params.id),
				reply,
				adminSecret: ADMIN_SECRET
			}),
		() => json({ success: true })
	);
};

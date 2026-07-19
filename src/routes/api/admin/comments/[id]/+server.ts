import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Id } from '$convex/_generated/dataModel';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { requireAdmin } from '$lib/server/admin';
import { replySchema } from '$lib/server/validation';
import { runConvex, parseBody } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const DELETE: RequestHandler = async ({ params, request, url }) => {
	requireAdmin(request);

	if (url.searchParams.get('soft') === '1') {
		return runConvex(
			() =>
				convex.action(api.commentActions.softDeleteComment, {
					commentId: params.id as Id<'comments'>,
					ipHash: '',
					adminSecret: ADMIN_SECRET
				}),
			() => json({ success: true })
		);
	}

	return runConvex(
		() =>
			convex.mutation(api.comments.hardDelete, {
				commentId: params.id as Id<'comments'>,
				adminSecret: ADMIN_SECRET
			}),
		() => json({ success: true })
	);
};

export const POST: RequestHandler = async ({ params, request }) => {
	requireAdmin(request);
	const { reply } = await parseBody(request, replySchema);

	return runConvex(
		() =>
			convex.mutation(api.comments.setReply, {
				commentId: params.id as Id<'comments'>,
				reply,
				adminSecret: ADMIN_SECRET
			}),
		() => json({ success: true })
	);
};

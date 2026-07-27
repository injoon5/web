import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Id } from '$convex/_generated/dataModel';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { editCommentSchema, deleteCommentSchema } from '$lib/server/validation';
import { requestIpHash } from '$lib/server/ip';
import { runConvex, parseBody } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const ipHash = requestIpHash(request);
	const admin = verifyAdminSecret(request);
	const { text, password } = await parseBody(request, editCommentSchema);

	return runConvex(
		() =>
			convex.action(api.commentActions.editComment, {
				commentId: params.id as Id<'comments'>,
				text,
				password: admin ? '' : password,
				ipHash,
				adminSecret: admin ? ADMIN_SECRET : undefined
			}),
		(updated) => json({ comment: updated })
	);
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	const ipHash = requestIpHash(request);
	const { password } = await parseBody(request, deleteCommentSchema);

	// Always soft-delete on the public route. Hard-delete is admin-only via
	// `/api/admin/comments/[id]` — never infer admin from the session cookie here,
	// or a logged-in owner using the visitor delete UI wipes whole threads.
	return runConvex(
		() =>
			convex.action(api.commentActions.softDeleteComment, {
				commentId: params.id as Id<'comments'>,
				password,
				ipHash
			}),
		() => json({ success: true })
	);
};

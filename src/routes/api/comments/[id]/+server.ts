import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
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
				commentId: params.id,
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
	const admin = verifyAdminSecret(request);

	if (!admin) {
		const { password } = await parseBody(request, deleteCommentSchema);
		return runConvex(
			() =>
				convex.action(api.commentActions.softDeleteComment, {
					commentId: params.id,
					password,
					ipHash
				}),
			() => json({ success: true })
		);
	}

	return runConvex(
		() =>
			convex.mutation(api.comments.hardDelete, {
				commentId: params.id,
				adminSecret: ADMIN_SECRET
			}),
		() => json({ success: true })
	);
};

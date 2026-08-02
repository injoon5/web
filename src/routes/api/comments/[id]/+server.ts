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

// This is the visitor-facing delete used by the comment UI on public pages, so
// it ALWAYS soft-deletes. It must not branch on admin auth: the site owner
// browses their own posts while holding an admin_token cookie, and branching
// here turned their ordinary "delete my comment" click into a hard delete that
// wiped the whole reply subtree. Hard delete is reachable only through the
// deliberate admin surface, DELETE /api/admin/comments/[id].
export const DELETE: RequestHandler = async ({ params, request }) => {
	const ipHash = requestIpHash(request);
	const { password } = await parseBody(request, deleteCommentSchema);

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

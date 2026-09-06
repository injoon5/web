import { json, error } from '@sveltejs/kit';
import { convex, backendSecret } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin.js';
import { editCommentSchema, deleteCommentSchema, parseConvexId } from '$lib/server/validation.js';
import { requestIpHash } from '$lib/server/ip.js';
import { runConvex, parseBody } from '$lib/server/api.js';
import { ADMIN_SECRET } from '$env/static/private';

/** @type {import('./$types').RequestHandler} */
export const PATCH = async ({ params, request }) => {
	const ipHash = requestIpHash(request);
	const admin = verifyAdminSecret(request);
	const commentId = parseConvexId(params.id);
	if (!commentId) throw error(400, 'Invalid comment id');
	const { text, password } = await parseBody(request, editCommentSchema);

	return runConvex(
		() =>
			convex.action(api.commentActions.editComment, {
				commentId,
				text,
				password: admin ? '' : password,
				ipHash,
				backendSecret,
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
/** @type {import('./$types').RequestHandler} */
export const DELETE = async ({ params, request }) => {
	const ipHash = requestIpHash(request);
	const commentId = parseConvexId(params.id);
	if (!commentId) throw error(400, 'Invalid comment id');
	const { password } = await parseBody(request, deleteCommentSchema);

	return runConvex(
		() =>
			convex.action(api.commentActions.softDeleteComment, {
				commentId,
				password,
				ipHash,
				backendSecret
			}),
		() => json({ success: true })
	);
};

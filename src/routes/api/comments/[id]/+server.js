import { convex } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import { visitorArgs } from '#lib/server/callers.js';
import { editCommentSchema, deleteCommentSchema, requireConvexId } from '#lib/server/validation.js';
import { runConvex, parseBody } from '#lib/server/api.js';

/** @type {import('./$types').RequestHandler} */
export const PATCH = async ({ params, request }) => {
	const visitor = visitorArgs(request);
	const commentId = requireConvexId(params.id);
	const { text, password } = await parseBody(request, editCommentSchema);

	// An admin's edit skips the password check in Convex (`authorizeOwner`).
	return runConvex(
		() => convex.action(api.commentActions.editComment, { commentId, text, password, ...visitor }),
		(updated) => Response.json({ comment: updated })
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
	const { ipHash, serverCredential } = visitorArgs(request);
	const commentId = requireConvexId(params.id);
	const { password } = await parseBody(request, deleteCommentSchema);

	return runConvex(
		() =>
			convex.action(api.commentActions.softDeleteComment, {
				commentId,
				password,
				ipHash,
				serverCredential
			}),
		() => Response.json({ success: true })
	);
};

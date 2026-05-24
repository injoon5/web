import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { editCommentSchema, deleteCommentSchema } from '$lib/server/validation';
import { getClientIp, hashIp } from '$lib/server/ip';
import { runConvex, handleConvexErr } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

async function requireCommentPassword(commentId: string, password: string) {
	let result;
	try {
		result = await convex.action(api.commentActions.verifyCommentPassword, {
			commentId,
			password
		});
	} catch (err) {
		return handleConvexErr(err);
	}
	if (result.reason === 'not_found') throw error(404, 'Comment not found');
	if (!result.valid) throw error(401, 'Incorrect password');
	return null;
}

export const PATCH: RequestHandler = async ({ params, request }) => {
	const ipHash = hashIp(getClientIp(request));
	const admin = verifyAdminSecret(request);

	let raw;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	const parsed = editCommentSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');
	const { text, password } = parsed.data;

	if (!admin) {
		const authErr = await requireCommentPassword(params.id, password);
		if (authErr) return authErr;
	}

	return runConvex(
		() =>
			convex.mutation(api.comments.applyEdit, {
				commentId: params.id,
				text,
				ipHash,
				adminSecret: admin ? ADMIN_SECRET : undefined
			}),
		(updated) => json({ comment: updated })
	);
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	const ipHash = hashIp(getClientIp(request));
	const admin = verifyAdminSecret(request);

	if (!admin) {
		let raw;
		try {
			raw = await request.json();
		} catch {
			throw error(400, 'Invalid request body');
		}
		const parsed = deleteCommentSchema.safeParse(raw);
		if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');

		const authErr = await requireCommentPassword(params.id, parsed.data.password);
		if (authErr) return authErr;
	}

	if (admin) {
		return runConvex(
			() =>
				convex.mutation(api.comments.hardDelete, {
					commentId: params.id,
					adminSecret: ADMIN_SECRET
				}),
			() => json({ success: true })
		);
	}

	return runConvex(
		() =>
			convex.mutation(api.comments.softDelete, {
				commentId: params.id,
				ipHash
			}),
		() => json({ success: true })
	);
};

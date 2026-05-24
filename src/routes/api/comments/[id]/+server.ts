import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { editCommentSchema } from '$lib/server/validation';
import { getClientIp, hashIp } from '$lib/server/ip';
import { runConvex, handleConvexErr } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';
import bcrypt from 'bcryptjs';

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

	let auth;
	try {
		auth = await convex.query(api.comments.getForAuth, { commentId: params.id });
	} catch (err) {
		return handleConvexErr(err);
	}
	if (!auth || auth.deletedAt !== null) throw error(404, 'Comment not found');

	const passwordMatch = await bcrypt.compare(password, auth.passwordHash);
	if (!passwordMatch) throw error(401, 'Incorrect password');

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
	const admin = verifyAdminSecret(request);

	if (!admin) {
		let raw: { password?: unknown };
		try {
			raw = await request.json();
		} catch {
			throw error(400, 'Invalid request body');
		}
		const password = typeof raw?.password === 'string' ? raw.password : null;
		if (!password || password.length < 4)
			throw error(400, 'Password must be at least 4 characters');

		let auth;
		try {
			auth = await convex.query(api.comments.getForAuth, { commentId: params.id });
		} catch (err) {
			return handleConvexErr(err);
		}
		if (!auth || auth.deletedAt !== null) throw error(404, 'Comment not found');

		const passwordMatch = await bcrypt.compare(password, auth.passwordHash);
		if (!passwordMatch) throw error(401, 'Incorrect password');
	}

	return runConvex(
		() =>
			convex.mutation(api.comments.hardDelete, { commentId: params.id, adminSecret: ADMIN_SECRET }),
		() => json({ success: true })
	);
};

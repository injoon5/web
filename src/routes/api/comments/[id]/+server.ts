import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { editCommentSchema } from '$lib/server/validation';
import { getClientIp, hashIp } from '$lib/server/ip';
import { convexErrorToResponse } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';
import bcrypt from 'bcryptjs';

// PATCH /api/comments/[id] - Edit a comment (requires password)
export const PATCH: RequestHandler = async ({ params, request }) => {
	const { id } = params;
	if (!id) throw error(400, 'Missing comment id');

	const ipHash = hashIp(getClientIp(request));
	const admin = verifyAdminSecret(request);

	let raw;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	const parsed = editCommentSchema.safeParse(raw);
	if (!parsed.success) {
		throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');
	}
	const { text, password } = parsed.data;

	let auth;
	try {
		auth = await convex.query(api.comments.getForAuth, { commentId: id });
	} catch (err) {
		const mapped = convexErrorToResponse(err);
		if (mapped instanceof Response) return mapped;
		throw mapped;
	}
	if (!auth || auth.deletedAt !== null) throw error(404, 'Comment not found');

	const passwordMatch = await bcrypt.compare(password, auth.passwordHash);
	if (!passwordMatch) throw error(401, 'Incorrect password');

	try {
		const updated = await convex.mutation(api.comments.applyEdit, {
			commentId: id,
			text,
			ipHash,
			adminSecret: admin ? ADMIN_SECRET : undefined
		});
		return json({ comment: updated });
	} catch (err) {
		const mapped = convexErrorToResponse(err);
		if (mapped instanceof Response) return mapped;
		throw mapped;
	}
};

// DELETE /api/comments/[id]
// Hard-delete in both cases. Admin: via secret header. User: via password body.
export const DELETE: RequestHandler = async ({ params, request }) => {
	const { id } = params;
	if (!id) throw error(400, 'Missing comment id');

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
			auth = await convex.query(api.comments.getForAuth, { commentId: id });
		} catch (err) {
			const mapped = convexErrorToResponse(err);
			if (mapped instanceof Response) return mapped;
			throw mapped;
		}
		if (!auth || auth.deletedAt !== null) throw error(404, 'Comment not found');

		const passwordMatch = await bcrypt.compare(password, auth.passwordHash);
		if (!passwordMatch) throw error(401, 'Incorrect password');
	}

	try {
		await convex.mutation(api.comments.hardDelete, {
			commentId: id,
			adminSecret: ADMIN_SECRET
		});
		return json({ success: true });
	} catch (err) {
		const mapped = convexErrorToResponse(err);
		if (mapped instanceof Response) return mapped;
		throw mapped;
	}
};

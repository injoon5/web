import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '../../../../convex/_generated/api';
import { verifyAdminSecret } from '$lib/server/admin';
import { editCommentSchema } from '$lib/server/validation';
import { getClientIp, hashIp } from '$lib/server/ip';
import { handleConvexError } from '$lib/server/convexError';
import bcrypt from 'bcryptjs';

// PATCH /api/comments/[id] — Edit a comment (requires password)
export const PATCH: RequestHandler = async ({ params, request }) => {
	const ipHash = hashIp(getClientIp(request));

	const { id } = params;
	const raw = await request.json();
	const parsed = editCommentSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');
	const { text, password } = parsed.data;

	const row = await convex.query(api.comments.getCommentForEdit, { id });
	if (!row) throw error(404, 'Comment not found');

	const passwordMatch = await bcrypt.compare(password, row.passwordHash);
	if (!passwordMatch) throw error(401, 'Incorrect password');

	try {
		const updated = await convex.mutation(api.comments.editComment, { id, text, ipHash });
		return json({ comment: updated });
	} catch (err) {
		return handleConvexError(err, 'Too many edit requests. Please slow down.');
	}
};

// DELETE /api/comments/[id]
// Admin path: hard-delete (sets deletedAt)
// User path: soft-delete (sets text + username to '[deleted]'), requires password
export const DELETE: RequestHandler = async ({ params, request }) => {
	const { id } = params;

	if (verifyAdminSecret(request)) {
		await convex.mutation(api.comments.hardDeleteComment, { id });
		return json({ success: true });
	}

	let raw: { password?: unknown };
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	const password = typeof raw?.password === 'string' ? raw.password : null;
	if (!password || password.length < 4) throw error(400, 'Password must be at least 4 characters');

	const ipHash = hashIp(getClientIp(request));

	const row = await convex.query(api.comments.getCommentForEdit, { id });
	if (!row) throw error(404, 'Comment not found');

	const passwordMatch = await bcrypt.compare(password, row.passwordHash);
	if (!passwordMatch) throw error(401, 'Incorrect password');

	try {
		await convex.mutation(api.comments.softDeleteComment, { id, ipHash });
		return json({ success: true });
	} catch (err) {
		return handleConvexError(err, 'Too many requests. Please slow down.');
	}
};

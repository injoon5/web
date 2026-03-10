import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { comments } from '$lib/server/db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { verifyAdminSecret } from '$lib/server/admin';
import { editCommentSchema } from '$lib/server/validation';
import { editRatelimit } from '$lib/server/redis';
import { getClientIp, hashIp } from '$lib/server/ip';
import bcrypt from 'bcryptjs';

// PATCH /api/comments/[id] - Edit a comment (requires password)
export const PATCH: RequestHandler = async ({ params, request }) => {
	const ipHash = hashIp(getClientIp(request));
	const { success } = await editRatelimit.limit(ipHash);
	if (!success) throw error(429, 'Too many edit requests. Please slow down.');

	const { id } = params;
	const raw = await request.json();
	const parsed = editCommentSchema.safeParse(raw);
	if (!parsed.success) {
		throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');
	}
	const { text, password } = parsed.data;

	const [comment] = await db
		.select()
		.from(comments)
		.where(and(eq(comments.id, id), isNull(comments.deletedAt)))
		.limit(1);

	if (!comment) throw error(404, 'Comment not found');

	const passwordMatch = await bcrypt.compare(password, comment.passwordHash);
	if (!passwordMatch) throw error(401, 'Incorrect password');

	const [updated] = await db
		.update(comments)
		.set({ text, updatedAt: new Date() })
		.where(eq(comments.id, id))
		.returning({
			id: comments.id,
			text: comments.text,
			updatedAt: comments.updatedAt
		});

	return json({ comment: updated });
};

// DELETE /api/comments/[id]
// - Admin (via secret header): hard-delete (sets deletedAt)
// - User (via password body): soft-delete (sets text + username to '[deleted]')
export const DELETE: RequestHandler = async ({ params, request }) => {
	const { id } = params;

	// Admin path
	if (verifyAdminSecret(request)) {
		await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, id));
		return json({ success: true });
	}

	// User path – requires password
	let raw: { password?: unknown };
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	const password = typeof raw?.password === 'string' ? raw.password : null;
	if (!password || password.length < 4) throw error(400, 'Password must be at least 4 characters');

	const ipHash = hashIp(getClientIp(request));
	const { success } = await editRatelimit.limit(ipHash);
	if (!success) throw error(429, 'Too many requests. Please slow down.');

	const [comment] = await db
		.select()
		.from(comments)
		.where(and(eq(comments.id, id), isNull(comments.deletedAt)))
		.limit(1);

	if (!comment) throw error(404, 'Comment not found');

	const passwordMatch = await bcrypt.compare(password, comment.passwordHash);
	if (!passwordMatch) throw error(401, 'Incorrect password');

	await db
		.update(comments)
		.set({ text: '[deleted]', username: '[deleted]', updatedAt: new Date() })
		.where(eq(comments.id, id));

	return json({ success: true });
};

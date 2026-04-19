import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { checkRateLimit, logRateLimit } from '$lib/server/ratelimit.js';
import { verifyAdminSecret } from '$lib/server/admin';
import { editCommentSchema } from '$lib/server/validation';
import { getClientIp, hashIp } from '$lib/server/ip';
import bcrypt from 'bcryptjs';

// PATCH /api/comments/[id] — edit a comment (requires password)
export const PATCH = async ({ params, request }) => {
	const ipHash = hashIp(getClientIp(request));

	if (!verifyAdminSecret(request)) {
		const rl = await checkRateLimit(ipHash, 'edit');
		if (rl.limited) throw error(429, 'Too many edit requests. Please slow down.');
	}

	const { id } = params;
	const raw = await request.json();
	const parsed = editCommentSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');
	const { text, password } = parsed.data;

	const { comments } = await db.query({
		comments: { $: { where: { id, deletedAt: { $isNull: true } } } },
	});
	const comment = comments[0];
	if (!comment) throw error(404, 'Comment not found');

	const passwordMatch = await bcrypt.compare(password, comment.passwordHash);
	if (!passwordMatch) throw error(401, 'Incorrect password');

	const now = new Date().toISOString();
	await db.transact(db.tx.comments[id].update({ text, updatedAt: now }));

	if (!verifyAdminSecret(request)) {
		await logRateLimit(ipHash, 'edit');
	}

	return json({ comment: { id, text, updatedAt: now } });
};

// DELETE /api/comments/[id]
// Admin (secret header): hard-delete (sets deletedAt)
// User (password body): soft-delete (sets text + username to '[deleted]')
export const DELETE = async ({ params, request }) => {
	const { id } = params;

	if (verifyAdminSecret(request)) {
		await db.transact(
			db.tx.comments[id].update({ deletedAt: new Date().toISOString() })
		);
		return json({ success: true });
	}

	// User path — requires password
	let raw;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	const password = typeof raw?.password === 'string' ? raw.password : null;
	if (!password || password.length < 4) throw error(400, 'Password must be at least 4 characters');

	const ipHash = hashIp(getClientIp(request));
	const rl = await checkRateLimit(ipHash, 'edit');
	if (rl.limited) throw error(429, 'Too many requests. Please slow down.');

	const { comments } = await db.query({
		comments: { $: { where: { id, deletedAt: { $isNull: true } } } },
	});
	const comment = comments[0];
	if (!comment) throw error(404, 'Comment not found');

	const passwordMatch = await bcrypt.compare(password, comment.passwordHash);
	if (!passwordMatch) throw error(401, 'Incorrect password');

	const now = new Date().toISOString();
	await db.transact(
		db.tx.comments[id].update({ text: '[deleted]', username: '[deleted]', updatedAt: now })
	);

	await logRateLimit(ipHash, 'edit');

	return json({ success: true });
};

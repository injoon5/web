import { json, error } from '@sveltejs/kit';
import { id } from '@instantdb/admin';
import { db } from '$lib/server/db';
import { verifyAdminSecret } from '$lib/server/admin';
import { banSchema } from '$lib/server/validation';

export const GET = async ({ request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const { bannedIps } = await db.query({
		bannedIps: {},
	});

	const bans = [...bannedIps].sort(
		(a, b) => new Date(b.createdAt) - new Date(a.createdAt)
	);

	return json({ bans });
};

export const POST = async ({ request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const raw = await request.json();
	const parsed = banSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');
	const { commentId, reason } = parsed.data;

	// Look up the comment's IP hash
	const { comments } = await db.query({
		comments: { $: { where: { id: commentId } } },
	});
	const comment = comments[0];
	if (!comment) throw error(404, 'Comment not found');

	// Check for existing ban
	const { bannedIps: existing } = await db.query({
		bannedIps: { $: { where: { ipHash: comment.ipHash } } },
	});

	let ban;
	if (existing.length > 0) {
		// Update existing ban
		await db.transact(
			db.tx.bannedIps[existing[0].id].update({ reason: reason?.trim() || null })
		);
		ban = { ...existing[0], reason: reason?.trim() || null };
	} else {
		// Create new ban
		const banId = id();
		const now = new Date().toISOString();
		await db.transact(
			db.tx.bannedIps[banId].update({
				ipHash: comment.ipHash,
				reason: reason?.trim() || null,
				createdAt: now,
			})
		);
		ban = { id: banId, ipHash: comment.ipHash, reason: reason?.trim() || null, createdAt: now };
	}

	return json({ ban }, { status: 201 });
};

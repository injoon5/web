import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex, api } from '$lib/server/convex.js';
import { verifyAdminSecret } from '$lib/server/admin';
import { banSchema } from '$lib/server/validation';

export const GET: RequestHandler = async ({ request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const bans = await convex.query(api.bans.getBans, {});

	return json({ bans });
};

export const POST: RequestHandler = async ({ request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const raw = await request.json();
	const parsed = banSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');
	const { commentId, reason } = parsed.data;

	// Look up the comment's IP hash
	let ipHash: string | null;
	try {
		ipHash = await convex.query(api.bans.getCommentIpHash, { commentId });
	} catch {
		throw error(404, 'Comment not found');
	}
	if (!ipHash) throw error(404, 'Comment not found');

	// Upsert ban (creates or updates reason if already banned)
	const ban = await convex.mutation(api.bans.createBan, {
		ipHash,
		reason: reason?.trim() || undefined
	});

	return json({ ban }, { status: 201 });
};

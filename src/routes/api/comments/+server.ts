import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex, api } from '$lib/server/convex.js';
import { commentRatelimit } from '$lib/server/redis';
import { getClientIp, hashIp } from '$lib/server/ip';
import { createCommentSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';
import bcrypt from 'bcryptjs';

export const GET: RequestHandler = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');

	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const comments = await convex.query(api.comments.getPublicComments, { url: pageUrl, ipHash });

	return json({ comments });
};

export const POST: RequestHandler = async ({ request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	// Check if IP is banned
	const isBanned = await convex.query(api.bans.checkBan, { ipHash });
	if (isBanned) throw error(403, 'You have been banned from commenting');

	// Rate limit (skipped for admin)
	if (!verifyAdminSecret(request)) {
		const { success, reset } = await commentRatelimit.limit(ipHash);
		if (!success) {
			const retryAfter = Math.ceil((reset - Date.now()) / 1000);
			return new Response(JSON.stringify({ error: 'Too many comments. Please wait before posting again.' }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': String(retryAfter)
				}
			});
		}
	}

	const raw = await request.json();
	const parsed = createCommentSchema.safeParse(raw);
	if (!parsed.success) {
		throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');
	}
	const { url: pageUrl, username, password, text, parentId } = parsed.data;

	// Validate parent and determine depth
	let depth = 0;
	if (parentId) {
		let parent;
		try {
			parent = await convex.query(api.comments.getParentForDepthCheck, { id: parentId });
		} catch {
			throw error(400, 'Parent comment not found');
		}
		if (!parent) throw error(400, 'Parent comment not found');
		if (parent.depth >= 2) throw error(400, 'Maximum reply depth reached');
		depth = parent.depth + 1;
	}

	const passwordHash = await bcrypt.hash(password, 10);

	const comment = await convex.mutation(api.comments.create, {
		url: pageUrl,
		username: username?.trim() || 'Anonymous',
		passwordHash,
		text,
		ipHash,
		...(parentId ? { parentId, depth } : { depth: 0 })
	});

	return json({ comment }, { status: 201 });
};

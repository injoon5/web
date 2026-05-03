import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '../../../convex/_generated/api';
import { getClientIp, hashIp } from '$lib/server/ip';
import { createCommentSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';
import { isValidPageUrl } from '$lib/server/valid-urls';
import { handleConvexError } from '$lib/server/convexError';
import bcrypt from 'bcryptjs';

export const GET: RequestHandler = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');

	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const comments = await convex.query(api.comments.getComments, { url: pageUrl, ipHash });
	return json({ comments });
};

export const POST: RequestHandler = async ({ request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);
	const isAdmin = verifyAdminSecret(request);

	let raw;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	const parsed = createCommentSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');

	const { url: pageUrl, username, password, text, parentId } = parsed.data;
	if (!isValidPageUrl(pageUrl)) throw error(404, 'Page not found');

	let depth = 0;
	if (parentId) {
		const parent = await convex.query(api.comments.getComment, { id: parentId });
		if (!parent) throw error(400, 'Parent comment not found');
		if (parent.depth >= 2) throw error(400, 'Maximum reply depth reached');
		depth = parent.depth + 1;
	}

	const passwordHash = await bcrypt.hash(password, 10);

	try {
		const comment = await convex.mutation(api.comments.createComment, {
			url: pageUrl,
			username: username?.trim() || 'Anonymous',
			passwordHash,
			text,
			ipHash,
			parentId: parentId || undefined,
			depth,
			isAdmin: isAdmin || undefined
		});
		return json({ comment }, { status: 201 });
	} catch (err) {
		return handleConvexError(err, 'Too many comments. Please wait before posting again.');
	}
};

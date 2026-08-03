import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { requestIpHash } from '$lib/server/ip';
import { createCommentSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';
import { isValidPageUrl } from '$lib/server/valid-urls';
import { runConvex, parseBody, handleConvexErr } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';
import bcrypt from 'bcryptjs';

export const GET: RequestHandler = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');
	const ipHash = requestIpHash(request);
	return runConvex(
		() => convex.query(api.comments.list, { url: pageUrl, ipHash }),
		(comments) => json({ comments })
	);
};

export const POST: RequestHandler = async ({ request }) => {
	const ipHash = requestIpHash(request);
	const admin = verifyAdminSecret(request);

	const {
		url: pageUrl,
		username,
		password,
		text,
		parentId
	} = await parseBody(request, createCommentSchema);

	if (!isValidPageUrl(pageUrl)) throw error(404, 'Page not found');

	// Ask whether this IP may comment at all before spending ~100ms of CPU on
	// bcrypt. `create` re-checks and is what actually consumes the token; this
	// only moves the rejection in front of the expensive part, so a banned or
	// rate-limited caller costs two indexed reads instead of a hash.
	try {
		await convex.mutation(api.comments.checkCanCreate, {
			ipHash,
			adminSecret: admin ? ADMIN_SECRET : undefined
		});
	} catch (err) {
		return handleConvexErr(err);
	}

	const passwordHash = await bcrypt.hash(password, 10);
	return runConvex(
		() =>
			convex.mutation(api.comments.create, {
				url: pageUrl,
				username: username ?? 'Anonymous',
				passwordHash,
				text,
				parentId,
				ipHash,
				adminSecret: admin ? ADMIN_SECRET : undefined
			}),
		(comment) => json({ comment }, { status: 201 })
	);
};

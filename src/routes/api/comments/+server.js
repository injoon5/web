import { json, error } from '@sveltejs/kit';
import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { requestIpHash } from '$lib/server/ip.js';
import { createCommentSchema } from '$lib/server/validation.js';
import { verifyAdminSecret } from '$lib/server/admin.js';
import { isValidPageUrl } from '$lib/server/valid-urls.js';
import { runConvex, parseBody, handleConvexErr } from '$lib/server/api.js';
import { ADMIN_SECRET } from '$env/static/private';
import bcrypt from 'bcryptjs';

const MAX_PAGE = 50;

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');

	const numItems = Math.min(
		Math.max(Math.floor(Number(url.searchParams.get('numItems')) || 25), 1),
		MAX_PAGE
	);
	const cursor = url.searchParams.get('cursor') ?? null;
	const ipHash = requestIpHash(request);

	return runConvex(
		() =>
			convex.query(api.comments.list, {
				url: pageUrl,
				ipHash,
				paginationOpts: { numItems, cursor }
			}),
		(result) =>
			json({ comments: result.page, continueCursor: result.continueCursor, isDone: result.isDone })
	);
};

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request }) => {
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

import { error } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { convex } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import { requestIpHash } from '#lib/server/ip.js';
import { visitorArgs } from '#lib/server/callers.js';
import { createCommentSchema } from '#lib/server/validation.js';
import { isArticleUrl } from '#lib/server/article-index.js';
import { runConvex, parseBody } from '#lib/server/api.js';

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

	return runConvex(
		() =>
			convex.query(api.comments.list, {
				url: pageUrl,
				ipHash: requestIpHash(request),
				paginationOpts: { numItems, cursor }
			}),
		(result) =>
			Response.json({
				comments: result.page,
				continueCursor: result.continueCursor,
				isDone: result.isDone
			})
	);
};

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request }) => {
	const visitor = visitorArgs(request);
	const {
		url: pageUrl,
		username,
		password,
		text,
		parentId
	} = await parseBody(request, createCommentSchema);
	if (!isArticleUrl(pageUrl)) throw error(404, 'Page not found');

	// Ask whether this IP may comment at all before spending ~100ms of CPU on
	// bcrypt. `create` re-checks and is what actually consumes the token; this
	// only moves the rejection in front of the expensive part, so a banned or
	// rate-limited caller costs two indexed reads instead of a hash.
	const gate = await runConvex(
		() => convex.mutation(api.comments.checkCanCreate, visitor),
		() => new Response(null, { status: 204 })
	);
	if (!gate.ok) return gate;

	const passwordHash = await bcrypt.hash(password, 10);
	return runConvex(
		() =>
			convex.mutation(api.comments.create, {
				url: pageUrl,
				username,
				passwordHash,
				text,
				parentId,
				...visitor
			}),
		(comment) => Response.json({ comment }, { status: 201 })
	);
};

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '$convex/_generated/api';
import { getClientIp, hashIp } from '$lib/server/ip';
import { likeSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';
import { isValidPageUrl } from '$lib/server/valid-urls';
import { runConvex } from '$lib/server/api';
import { ADMIN_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');
	const ipHash = getRequestIpHash(request);
	return runConvex(() => convex.query(api.likes.get, { url: pageUrl, ipHash }));
};

export const POST: RequestHandler = async ({ request }) => {
	const ipHash = getRequestIpHash(request);
	const admin = verifyAdminSecret(request);

	let raw;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	const parsed = likeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Missing url');

	const { url: pageUrl } = parsed.data;
	if (!isValidPageUrl(pageUrl)) throw error(404, 'Page not found');

	return runConvex(() =>
		convex.mutation(api.likes.toggle, {
			url: pageUrl,
			ipHash,
			adminSecret: admin ? ADMIN_SECRET : undefined
		})
	);
};

function getRequestIpHash(request: Request) {
	return hashIp(getClientIp(request));
}

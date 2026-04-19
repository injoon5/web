import { json, error } from '@sveltejs/kit';
import { id } from '@instantdb/admin';
import { db } from '$lib/server/db';
import { checkRateLimit, logRateLimit } from '$lib/server/ratelimit.js';
import { getClientIp, hashIp } from '$lib/server/ip';
import { likeSchema } from '$lib/server/validation';
import { isValidPageUrl } from '$lib/server/valid-urls';
import { verifyAdminSecret } from '$lib/server/admin';

export const GET = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');

	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const { likes } = await db.query({
		likes: { $: { where: { url: pageUrl } } },
	});

	const count = likes.length;
	const liked = likes.some((l) => l.ipHash === ipHash);

	return json({ count, liked });
};

export const POST = async ({ request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	// Ban check
	const { bannedIps } = await db.query({
		bannedIps: { $: { where: { ipHash } } },
	});
	if (bannedIps.length > 0) throw error(403, 'You have been banned');

	// Rate limit (skipped for admin)
	if (!verifyAdminSecret(request)) {
		const rl = await checkRateLimit(ipHash, 'like');
		if (rl.limited) throw error(429, 'Too many requests. Please slow down.');
	}

	const raw = await request.json();
	const parsed = likeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Missing url');
	const { url: pageUrl } = parsed.data;

	if (!isValidPageUrl(pageUrl)) throw error(404, 'Page not found');

	// Check existing like
	const { likes: existing } = await db.query({
		likes: { $: { where: { url: pageUrl, ipHash } } },
	});

	if (existing.length > 0) {
		// Unlike
		await db.transact(db.tx.likes[existing[0].id].delete());
	} else {
		// Like
		await db.transact(
			db.tx.likes[id()].update({
				url: pageUrl,
				ipHash,
				createdAt: new Date().toISOString(),
			})
		);
	}

	if (!verifyAdminSecret(request)) {
		await logRateLimit(ipHash, 'like');
	}

	// Return updated count
	const { likes: allLikes } = await db.query({
		likes: { $: { where: { url: pageUrl } } },
	});

	const count = allLikes.length;
	const liked = allLikes.some((l) => l.ipHash === ipHash);

	return json({ count, liked });
};

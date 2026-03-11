import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { likes, bannedIps } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { likeRatelimit } from '$lib/server/redis';
import { getClientIp, hashIp } from '$lib/server/ip';
import { likeSchema } from '$lib/server/validation';

export const GET: RequestHandler = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');

	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const [result] = await db
		.select({
			count: sql<number>`cast(count(*) as int)`,
			liked: sql<boolean>`bool_or(${likes.ipHash} = ${ipHash})`
		})
		.from(likes)
		.where(eq(likes.url, pageUrl));

	return json({ count: result?.count ?? 0, liked: result?.liked ?? false }, {
		headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=300' }
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	// Check if IP is banned
	const ban = await db.select().from(bannedIps).where(eq(bannedIps.ipHash, ipHash)).limit(1);
	if (ban.length > 0) throw error(403, 'You have been banned');

	// Rate limit
	const { success } = await likeRatelimit.limit(ipHash);
	if (!success) throw error(429, 'Too many requests. Please slow down.');

	const raw = await request.json();
	const parsed = likeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Missing url');
	const { url: pageUrl } = parsed.data;

	// Check existing like
	const [existing] = await db
		.select()
		.from(likes)
		.where(and(eq(likes.url, pageUrl), eq(likes.ipHash, ipHash)))
		.limit(1);

	if (existing) {
		// Unlike
		await db.delete(likes).where(and(eq(likes.url, pageUrl), eq(likes.ipHash, ipHash)));
	} else {
		// Like
		await db.insert(likes).values({ url: pageUrl, ipHash });
	}

	// Return updated count
	const [result] = await db
		.select({
			count: sql<number>`cast(count(*) as int)`,
			liked: sql<boolean>`bool_or(${likes.ipHash} = ${ipHash})`
		})
		.from(likes)
		.where(eq(likes.url, pageUrl));

	return json({ count: result?.count ?? 0, liked: !existing });
};

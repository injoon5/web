import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { likes, bannedIps } from '$lib/server/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { likeRatelimit } from '$lib/server/redis';
import { getClientIp, hashIp } from '$lib/server/ip';
import { likeSchema } from '$lib/server/validation';

export const GET = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');

	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const [result] = await db
		.select({
			count: sql`cast(count(*) as int)`,
			liked: sql`bool_or(${likes.ipHash} = ${ipHash})`
		})
		.from(likes)
		.where(eq(likes.url, pageUrl));

	return json({ count: result?.count ?? 0, liked: result?.liked ?? false });
};

export const POST = async ({ request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const ban = await db.select().from(bannedIps).where(eq(bannedIps.ipHash, ipHash)).limit(1);
	if (ban.length > 0) throw error(403, 'You have been banned');

	const { success } = await likeRatelimit.limit(ipHash);
	if (!success) throw error(429, 'Too many requests. Please slow down.');

	const raw = await request.json();
	const parsed = likeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Missing url');
	const { url: pageUrl } = parsed.data;

	const [existing] = await db
		.select()
		.from(likes)
		.where(and(eq(likes.url, pageUrl), eq(likes.ipHash, ipHash)))
		.limit(1);

	if (existing) {
		await db.delete(likes).where(and(eq(likes.url, pageUrl), eq(likes.ipHash, ipHash)));
	} else {
		await db.insert(likes).values({ url: pageUrl, ipHash });
	}

	const [result] = await db
		.select({
			count: sql`cast(count(*) as int)`,
			liked: sql`bool_or(${likes.ipHash} = ${ipHash})`
		})
		.from(likes)
		.where(eq(likes.url, pageUrl));

	return json({ count: result?.count ?? 0, liked: !existing });
};

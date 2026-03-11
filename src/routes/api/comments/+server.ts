import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { comments, commentVotes, bannedIps } from '$lib/server/db/schema';
import { eq, isNull, and, sql, desc } from 'drizzle-orm';
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

	const rows = await db
		.select({
			id: comments.id,
			url: comments.url,
			username: comments.username,
			text: comments.text,
			reply: comments.reply,
			parentId: comments.parentId,
			depth: comments.depth,
			createdAt: comments.createdAt,
			updatedAt: comments.updatedAt,
			upvotes: sql<number>`cast(count(case when ${commentVotes.voteType} = 'up' then 1 end) as int)`,
			downvotes: sql<number>`cast(count(case when ${commentVotes.voteType} = 'down' then 1 end) as int)`,
			score: sql<number>`cast(count(case when ${commentVotes.voteType} = 'up' then 1 end) as int) - cast(count(case when ${commentVotes.voteType} = 'down' then 1 end) as int)`,
			myVote: sql<string | null>`max(case when ${commentVotes.ipHash} = ${ipHash} then ${commentVotes.voteType}::text end)`
		})
		.from(comments)
		.leftJoin(commentVotes, eq(commentVotes.commentId, comments.id))
		.where(and(eq(comments.url, pageUrl), isNull(comments.deletedAt)))
		.groupBy(comments.id)
		.orderBy(
			sql`cast(count(case when ${commentVotes.voteType} = 'up' then 1 end) as int) - cast(count(case when ${commentVotes.voteType} = 'down' then 1 end) as int) desc`,
			desc(comments.createdAt)
		)
		.limit(200);

	return json({ comments: rows }, {
		headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=300' }
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	// Check if IP is banned
	const ban = await db
		.select()
		.from(bannedIps)
		.where(eq(bannedIps.ipHash, ipHash))
		.limit(1);

	if (ban.length > 0) {
		throw error(403, 'You have been banned from commenting');
	}

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
		const [parent] = await db
			.select({ id: comments.id, depth: comments.depth })
			.from(comments)
			.where(and(eq(comments.id, parentId), isNull(comments.deletedAt)))
			.limit(1);

		if (!parent) throw error(400, 'Parent comment not found');
		if (parent.depth >= 2) throw error(400, 'Maximum reply depth reached');
		depth = parent.depth + 1;
	}

	const passwordHash = await bcrypt.hash(password, 10);

	const [comment] = await db
		.insert(comments)
		.values({
			url: pageUrl,
			username: username?.trim() || 'Anonymous',
			passwordHash,
			text,
			ipHash,
			...(parentId ? { parentId, depth } : {})
		})
		.returning({
			id: comments.id,
			url: comments.url,
			username: comments.username,
			text: comments.text,
			reply: comments.reply,
			parentId: comments.parentId,
			depth: comments.depth,
			createdAt: comments.createdAt,
			updatedAt: comments.updatedAt
		});

	return json({ comment }, { status: 201 });
};

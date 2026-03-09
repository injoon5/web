import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { comments, commentVotes, bannedIps } from '$lib/server/db/schema';
import { eq, isNull, and, sql } from 'drizzle-orm';
import { voteRatelimit } from '$lib/server/redis';
import { getClientIp, hashIp } from '$lib/server/ip';
import { voteSchema } from '$lib/server/validation';

export const POST: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	// Check if IP is banned
	const ban = await db.select().from(bannedIps).where(eq(bannedIps.ipHash, ipHash)).limit(1);
	if (ban.length > 0) throw error(403, 'You have been banned');

	// Rate limit
	const { success } = await voteRatelimit.limit(ipHash);
	if (!success) throw error(429, 'Too many votes. Please slow down.');

	const { id: commentId } = params;
	const raw = await request.json();
	const parsed = voteSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid vote type');
	const { voteType } = parsed.data;

	// Check comment exists
	const [comment] = await db
		.select({ id: comments.id })
		.from(comments)
		.where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
		.limit(1);

	if (!comment) throw error(404, 'Comment not found');

	// Check existing vote
	const [existing] = await db
		.select()
		.from(commentVotes)
		.where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.ipHash, ipHash)))
		.limit(1);

	if (existing) {
		if (existing.voteType === voteType) {
			// Toggle off - remove vote
			await db
				.delete(commentVotes)
				.where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.ipHash, ipHash)));
		} else {
			// Change vote direction
			await db
				.update(commentVotes)
				.set({ voteType })
				.where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.ipHash, ipHash)));
		}
	} else {
		// New vote
		await db.insert(commentVotes).values({ commentId, ipHash, voteType });
	}

	// Return updated counts
	const [counts] = await db
		.select({
			upvotes: sql<number>`cast(count(case when ${commentVotes.voteType} = 'up' then 1 end) as int)`,
			downvotes: sql<number>`cast(count(case when ${commentVotes.voteType} = 'down' then 1 end) as int)`,
			myVote: sql<string | null>`max(case when ${commentVotes.ipHash} = ${ipHash} then ${commentVotes.voteType}::text end)`
		})
		.from(commentVotes)
		.where(eq(commentVotes.commentId, commentId));

	return json(counts);
};

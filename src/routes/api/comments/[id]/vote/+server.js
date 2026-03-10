import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { comments, commentVotes, bannedIps } from '$lib/server/db/schema.js';
import { eq, isNull, and, sql } from 'drizzle-orm';
import { voteRatelimit } from '$lib/server/redis';
import { getClientIp, hashIp } from '$lib/server/ip';
import { voteSchema } from '$lib/server/validation';

export const POST = async ({ params, request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	// 1. Ban check
	const ban = await db.select().from(bannedIps).where(eq(bannedIps.ipHash, ipHash)).limit(1);
	if (ban.length > 0) throw error(403, 'You have been banned');

	// Rate limit (Redis, not a DB query)
	const { success } = await voteRatelimit.limit(ipHash);
	if (!success) throw error(429, 'Too many votes. Please slow down.');

	const { id: commentId } = params;
	const raw = await request.json();
	const parsed = voteSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid vote type');
	const { voteType } = parsed.data;

	// 2. Comment exists + existing vote in one round-trip
	const [row] = await db
		.select({ commentId: comments.id, existingVoteType: commentVotes.voteType })
		.from(comments)
		.leftJoin(
			commentVotes,
			and(eq(commentVotes.commentId, commentId), eq(commentVotes.ipHash, ipHash))
		)
		.where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
		.limit(1);

	if (!row) throw error(404, 'Comment not found');

	// 3. Write + return updated counts in one CTE round-trip
	let writeOp;
	if (row.existingVoteType === voteType) {
		writeOp = sql`DELETE FROM comment_votes WHERE comment_id = ${commentId}::uuid AND ip_hash = ${ipHash}`;
	} else if (row.existingVoteType) {
		writeOp = sql`UPDATE comment_votes SET vote_type = ${voteType}::vote_type WHERE comment_id = ${commentId}::uuid AND ip_hash = ${ipHash}`;
	} else {
		writeOp = sql`INSERT INTO comment_votes (comment_id, ip_hash, vote_type) VALUES (${commentId}::uuid, ${ipHash}, ${voteType}::vote_type)`;
	}

	const result = await db.execute(sql`
		WITH write_op AS (${writeOp} RETURNING id)
		SELECT
			cast(count(case when vote_type = 'up' then 1 end) as int) as upvotes,
			cast(count(case when vote_type = 'down' then 1 end) as int) as downvotes,
			max(case when ip_hash = ${ipHash} then vote_type::text end) as my_vote
		FROM comment_votes
		WHERE comment_id = ${commentId}::uuid
	`);

	const counts = result[0];
	return json({ upvotes: counts.upvotes, downvotes: counts.downvotes, myVote: counts.my_vote });
};

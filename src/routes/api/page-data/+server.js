import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { comments, commentVotes, likes } from '$lib/server/db/schema';
import { eq, isNull, and, sql, desc } from 'drizzle-orm';
import { getClientIp, hashIp } from '$lib/server/ip';

export const GET = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');

	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const [likesResult, commentsResult] = await Promise.all([
		db
			.select({
				count: sql`cast(count(*) as int)`,
				liked: sql`bool_or(${likes.ipHash} = ${ipHash})`
			})
			.from(likes)
			.where(eq(likes.url, pageUrl))
			.then(([r]) => ({ count: r?.count ?? 0, liked: r?.liked ?? false })),

		db
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
				upvotes: sql`cast(count(case when ${commentVotes.voteType} = 'up' then 1 end) as int)`,
				downvotes: sql`cast(count(case when ${commentVotes.voteType} = 'down' then 1 end) as int)`,
				score: sql`cast(count(case when ${commentVotes.voteType} = 'up' then 1 end) as int) - cast(count(case when ${commentVotes.voteType} = 'down' then 1 end) as int)`,
				myVote: sql`max(case when ${commentVotes.ipHash} = ${ipHash} then ${commentVotes.voteType}::text end)`
			})
			.from(comments)
			.leftJoin(commentVotes, eq(commentVotes.commentId, comments.id))
			.where(and(eq(comments.url, pageUrl), isNull(comments.deletedAt)))
			.groupBy(comments.id)
			.orderBy(
				sql`cast(count(case when ${commentVotes.voteType} = 'up' then 1 end) as int) - cast(count(case when ${commentVotes.voteType} = 'down' then 1 end) as int) desc`,
				desc(comments.createdAt)
			)
			.limit(200)
	]);

	return json({ likes: likesResult, comments: commentsResult });
};

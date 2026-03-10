import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { comments, commentVotes } from '$lib/server/db/schema';
import { isNull, sql, desc } from 'drizzle-orm';
import { verifyAdminSecret } from '$lib/server/admin';

export const GET: RequestHandler = async ({ request, url }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const page = parseInt(url.searchParams.get('page') ?? '1');
	const limit = parseInt(url.searchParams.get('limit') ?? '50');
	const offset = (page - 1) * limit;

	const rows = await db
		.select({
			id: comments.id,
			url: comments.url,
			username: comments.username,
			text: comments.text,
			ipHash: comments.ipHash,
			reply: comments.reply,
			createdAt: comments.createdAt,
			updatedAt: comments.updatedAt,
			upvotes: sql<number>`cast(count(case when ${commentVotes.voteType} = 'up' then 1 end) as int)`,
			downvotes: sql<number>`cast(count(case when ${commentVotes.voteType} = 'down' then 1 end) as int)`
		})
		.from(comments)
		.leftJoin(commentVotes, sql`${commentVotes.commentId} = ${comments.id}`)
		.where(isNull(comments.deletedAt))
		.groupBy(comments.id)
		.orderBy(desc(comments.createdAt))
		.limit(limit)
		.offset(offset);

	return json({ comments: rows });
};

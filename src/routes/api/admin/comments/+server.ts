import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { comments, commentVotes } from '$lib/server/db/schema';
import { isNull, sql, desc, asc, eq, and } from 'drizzle-orm';
import { verifyAdminSecret } from '$lib/server/admin';

export const GET: RequestHandler = async ({ request, url }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const urlFilter = url.searchParams.get('url');

	if (!urlFilter) {
		// Return list of URLs with comment counts
		const rows = await db
			.select({
				url: comments.url,
				count: sql<number>`cast(count(*) as int)`
			})
			.from(comments)
			.where(isNull(comments.deletedAt))
			.groupBy(comments.url)
			.orderBy(desc(sql`count(*)`));

		return json({ urls: rows });
	}

	// Return comments for a specific URL, including parentId and depth for tree building
	const rows = await db
		.select({
			id: comments.id,
			url: comments.url,
			username: comments.username,
			text: comments.text,
			ipHash: comments.ipHash,
			parentId: comments.parentId,
			depth: comments.depth,
			reply: comments.reply,
			createdAt: comments.createdAt,
			updatedAt: comments.updatedAt,
			upvotes: sql<number>`cast(count(case when ${commentVotes.voteType} = 'up' then 1 end) as int)`,
			downvotes: sql<number>`cast(count(case when ${commentVotes.voteType} = 'down' then 1 end) as int)`
		})
		.from(comments)
		.leftJoin(commentVotes, sql`${commentVotes.commentId} = ${comments.id}`)
		.where(and(isNull(comments.deletedAt), eq(comments.url, urlFilter)))
		.groupBy(comments.id)
		.orderBy(asc(comments.createdAt));

	return json({ comments: rows });
};

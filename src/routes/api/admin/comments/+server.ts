import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { verifyAdminSecret } from '$lib/server/admin';

export const GET = async ({ request, url }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const urlFilter = url.searchParams.get('url');

	if (!urlFilter) {
		// Return list of URLs with comment counts
		const { comments } = await db.query({
			comments: { $: { where: { deletedAt: { $isNull: true } } } },
		});

		const urlCounts = {};
		for (const c of comments) {
			urlCounts[c.url] = (urlCounts[c.url] || 0) + 1;
		}

		const urls = Object.entries(urlCounts)
			.map(([url, count]) => ({ url, count }))
			.sort((a, b) => b.count - a.count);

		return json({ urls });
	}

	// Return comments for a specific URL including vote counts
	const { comments } = await db.query({
		comments: {
			$: { where: { url: urlFilter, deletedAt: { $isNull: true } } },
		},
	});

	const commentIds = comments.map((c) => c.id);
	let commentVotes = [];
	if (commentIds.length > 0) {
		const result = await db.query({
			commentVotes: { $: { where: { commentId: { $in: commentIds } } } },
		});
		commentVotes = result.commentVotes;
	}

	const upvoteMap = {};
	const downvoteMap = {};
	for (const vote of commentVotes) {
		const cid = vote.commentId;
		if (vote.voteType === 'up') upvoteMap[cid] = (upvoteMap[cid] || 0) + 1;
		else downvoteMap[cid] = (downvoteMap[cid] || 0) + 1;
	}

	const rows = comments
		.map((c) => ({
			id: c.id,
			url: c.url,
			username: c.username,
			text: c.text,
			ipHash: c.ipHash,
			parentId: c.parentId ?? null,
			depth: c.depth,
			reply: c.reply ?? null,
			createdAt: c.createdAt,
			updatedAt: c.updatedAt,
			upvotes: upvoteMap[c.id] || 0,
			downvotes: downvoteMap[c.id] || 0,
		}))
		.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

	return json({ comments: rows });
};

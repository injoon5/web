import { json, error } from '@sveltejs/kit';
import { id } from '@instantdb/admin';
import { db } from '$lib/server/db';
import { checkRateLimit, logRateLimit } from '$lib/server/ratelimit.js';
import { getClientIp, hashIp } from '$lib/server/ip';
import { voteSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';

export const POST = async ({ params, request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	// Ban check
	const { bannedIps } = await db.query({
		bannedIps: { $: { where: { ipHash } } },
	});
	if (bannedIps.length > 0) throw error(403, 'You have been banned');

	// Rate limit (skipped for admin)
	if (!verifyAdminSecret(request)) {
		const rl = await checkRateLimit(ipHash, 'vote');
		if (rl.limited) throw error(429, 'Too many votes. Please slow down.');
	}

	const { id: commentId } = params;
	const raw = await request.json();
	const parsed = voteSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid vote type');
	const { voteType } = parsed.data;

	// Verify comment exists and is not deleted
	const { comments } = await db.query({
		comments: { $: { where: { id: commentId, deletedAt: { $isNull: true } } } },
	});
	if (!comments[0]) throw error(404, 'Comment not found');

	// Find existing vote by this IP for this comment
	const { commentVotes } = await db.query({
		commentVotes: { $: { where: { commentId, ipHash } } },
	});
	const existing = commentVotes[0];

	if (existing) {
		if (existing.voteType === voteType) {
			// Toggle off — remove the vote
			await db.transact(db.tx.commentVotes[existing.id].delete());
		} else {
			// Change direction
			await db.transact(db.tx.commentVotes[existing.id].update({ voteType }));
		}
	} else {
		// New vote
		await db.transact(
			db.tx.commentVotes[id()].update({
				commentId,
				ipHash,
				voteType,
				createdAt: new Date().toISOString(),
			})
		);
	}

	if (!verifyAdminSecret(request)) {
		await logRateLimit(ipHash, 'vote');
	}

	// Return updated counts
	const { commentVotes: allVotes } = await db.query({
		commentVotes: { $: { where: { commentId } } },
	});

	let upvotes = 0;
	let downvotes = 0;
	let myVote = null;
	for (const v of allVotes) {
		if (v.voteType === 'up') upvotes++;
		else downvotes++;
		if (v.ipHash === ipHash) myVote = v.voteType;
	}

	return json({ upvotes, downvotes, myVote });
};

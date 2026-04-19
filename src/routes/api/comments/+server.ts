import { json, error } from '@sveltejs/kit';
import { id } from '@instantdb/admin';
import { db } from '$lib/server/db';
import { checkRateLimit, logRateLimit } from '$lib/server/ratelimit.js';
import { getClientIp, hashIp } from '$lib/server/ip';
import { createCommentSchema } from '$lib/server/validation';
import { verifyAdminSecret } from '$lib/server/admin';
import { isValidPageUrl } from '$lib/server/valid-urls';
import bcrypt from 'bcryptjs';

export const GET = async ({ url, request }) => {
	const pageUrl = url.searchParams.get('url');
	if (!pageUrl) throw error(400, 'Missing url parameter');

	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	const { comments, commentVotes } = await db.query({
		comments: {
			$: {
				where: { url: pageUrl, deletedAt: { $isNull: true } },
			},
		},
		commentVotes: {
			$: {
				where: { 'comment.url': pageUrl },
			},
		},
	});

	// Build vote maps
	const upvoteMap = {};
	const downvoteMap = {};
	const myVoteMap = {};

	for (const vote of commentVotes) {
		const cid = vote.commentId;
		if (vote.voteType === 'up') upvoteMap[cid] = (upvoteMap[cid] || 0) + 1;
		else downvoteMap[cid] = (downvoteMap[cid] || 0) + 1;
		if (vote.ipHash === ipHash) myVoteMap[cid] = vote.voteType;
	}

	const rows = comments.map((c) => ({
		id: c.id,
		url: c.url,
		username: c.username,
		text: c.text,
		reply: c.reply ?? null,
		parentId: c.parentId ?? null,
		depth: c.depth,
		createdAt: c.createdAt,
		updatedAt: c.updatedAt,
		upvotes: upvoteMap[c.id] || 0,
		downvotes: downvoteMap[c.id] || 0,
		score: (upvoteMap[c.id] || 0) - (downvoteMap[c.id] || 0),
		myVote: myVoteMap[c.id] ?? null,
	}));

	// Sort by score desc, then createdAt desc — mirrors the old SQL ORDER BY
	rows.sort((a, b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt));

	return json({ comments: rows.slice(0, 200) });
};

export const POST = async ({ request }) => {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);

	// Ban check
	const { bannedIps } = await db.query({
		bannedIps: { $: { where: { ipHash } } },
	});
	if (bannedIps.length > 0) throw error(403, 'You have been banned from commenting');

	// Rate limit (skipped for admin)
	if (!verifyAdminSecret(request)) {
		const rl = await checkRateLimit(ipHash, 'comment');
		if (rl.limited) {
			return new Response(
				JSON.stringify({ error: 'Too many comments. Please wait before posting again.' }),
				{
					status: 429,
					headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
				}
			);
		}
	}

	let raw;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	const parsed = createCommentSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');

	const { url: pageUrl, username, password, text, parentId } = parsed.data;
	if (!isValidPageUrl(pageUrl)) throw error(404, 'Page not found');

	// Validate parent and determine depth
	let depth = 0;
	if (parentId) {
		const { comments: parents } = await db.query({
			comments: {
				$: { where: { id: parentId, deletedAt: { $isNull: true } } },
			},
		});
		const parent = parents[0];
		if (!parent) throw error(400, 'Parent comment not found');
		if (parent.depth >= 2) throw error(400, 'Maximum reply depth reached');
		depth = parent.depth + 1;
	}

	const passwordHash = await bcrypt.hash(password, 10);
	const commentId = id();
	const now = new Date().toISOString();

	await db.transact(
		db.tx.comments[commentId].update({
			url: pageUrl,
			username: username?.trim() || 'Anonymous',
			passwordHash,
			text,
			ipHash,
			depth,
			...(parentId ? { parentId } : {}),
			createdAt: now,
			updatedAt: now,
		})
	);

	// Log rate limit event after successful insert
	if (!verifyAdminSecret(request)) {
		await logRateLimit(ipHash, 'comment');
	}

	const { comments } = await db.query({
		comments: { $: { where: { id: commentId } } },
	});
	const comment = comments[0];

	return json(
		{
			comment: {
				id: comment.id,
				url: comment.url,
				username: comment.username,
				text: comment.text,
				reply: comment.reply ?? null,
				parentId: comment.parentId ?? null,
				depth: comment.depth,
				createdAt: comment.createdAt,
				updatedAt: comment.updatedAt,
			},
		},
		{ status: 201 }
	);
};

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { bannedIps, comments } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { verifyAdminSecret } from '$lib/server/admin';
import { banSchema } from '$lib/server/validation';

export const GET = async ({ request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const bans = await db.select().from(bannedIps).orderBy(desc(bannedIps.createdAt));

	return json({ bans });
};

export const POST = async ({ request }) => {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');

	const raw = await request.json();
	const parsed = banSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.errors[0]?.message ?? 'Invalid request');
	const { commentId, reason } = parsed.data;

	const [comment] = await db
		.select({ ipHash: comments.ipHash })
		.from(comments)
		.where(eq(comments.id, commentId))
		.limit(1);

	if (!comment) throw error(404, 'Comment not found');

	const [ban] = await db
		.insert(bannedIps)
		.values({ ipHash: comment.ipHash, reason: reason?.trim() || null })
		.onConflictDoUpdate({
			target: bannedIps.ipHash,
			set: { reason: reason?.trim() || null }
		})
		.returning();

	return json({ ban }, { status: 201 });
};

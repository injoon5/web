import { z } from 'zod';

/**
 * Convex document IDs are lowercase base32 strings with no separators. This is
 * a shape guard, not a full validator — Convex stays the authority — but it lets
 * a malformed `params.id` fail as a 400 at the route instead of a 500 after
 * Convex rejects the argument.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isConvexId(value) {
	return typeof value === 'string' && /^[0-9a-z]+$/.test(value);
}

/**
 * Validate a route/body Convex id and return it, or null when malformed.
 * @template {string} T
 * @param {unknown} value
 * @returns {T | null}
 */
export function parseConvexId(value) {
	return isConvexId(value) ? /** @type {T} */ (value) : null;
}

const convexId = z.string().refine(isConvexId, 'Invalid id');

export const createCommentSchema = z.object({
	url: z.string().min(1),
	username: z.string().max(32).optional().default('Anonymous'),
	password: z.string().min(4, 'Password must be at least 4 characters'),
	// trim() first so the length limits validate what actually gets stored.
	text: z
		.string()
		.trim()
		.min(1, 'Comment cannot be empty')
		.max(200, 'Comment must be 200 characters or less'),
	parentId: convexId.optional()
});

export const editCommentSchema = z.object({
	text: z
		.string()
		.trim()
		.min(1, 'Comment cannot be empty')
		.max(200, 'Comment must be 200 characters or less'),
	// Verifies an existing password (already created with min 4), so only a
	// non-empty value is required here.
	password: z.string().min(1, 'Password is required')
});

export const deleteCommentSchema = z.object({
	password: z.string().min(1, 'Password is required')
});

export const voteSchema = z.object({
	voteType: z.enum(['up', 'down'])
});

export const likeSchema = z.object({
	url: z.string().min(1),
	liked: z.boolean().optional()
});

export const replySchema = z.object({
	reply: z.string().max(1000)
});

export const nowSchema = z.object({
	content: z.string().max(20000, 'Content must be 20000 characters or less')
});

export const banSchema = z.object({
	commentId: convexId,
	reason: z.string().max(500).optional()
});

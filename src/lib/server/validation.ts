import { z } from 'zod';

export const createCommentSchema = z.object({
	url: z.string().min(1),
	username: z.string().max(32).optional().default('Anonymous'),
	password: z.string().min(4, 'Password must be at least 4 characters'),
	// Trim before the length checks so whitespace-only text is rejected and a
	// trailing-space comment isn't refused for being "too long" after trimming.
	text: z
		.string()
		.trim()
		.min(1, 'Comment cannot be empty')
		.max(200, 'Comment must be 200 characters or less'),
	parentId: z.string().min(1).optional()
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
	commentId: z.string().min(1),
	reason: z.string().max(500).optional()
});

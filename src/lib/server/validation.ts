import { z } from 'zod';

export const createCommentSchema = z.object({
	url: z.string().min(1),
	username: z.string().max(32).optional().default('Anonymous'),
	password: z.string().min(4, 'Password must be at least 4 characters'),
	text: z.string().min(1, 'Comment cannot be empty').max(200, 'Comment must be 200 characters or less').trim(),
	parentId: z.string().optional()
});

export const editCommentSchema = z.object({
	text: z.string().min(1, 'Comment cannot be empty').max(200, 'Comment must be 200 characters or less').trim(),
	password: z.string().min(1, 'Password is required')
});

export const voteSchema = z.object({
	voteType: z.enum(['up', 'down'])
});

export const likeSchema = z.object({
	url: z.string().min(1)
});

export const replySchema = z.object({
	reply: z.string().max(1000)
});

export const banSchema = z.object({
	commentId: z.string().min(1),
	reason: z.string().max(500).optional()
});

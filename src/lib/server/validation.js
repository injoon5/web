// @ts-check
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import {
	MAX_REPLY_LENGTH,
	MIN_PASSWORD_LENGTH,
	commentTextError,
	usernameError
} from '#convex/lib/commentRules.js';

const CONVEX_ID = /^[0-9a-z]+$/;

/**
 * A route param that has to be a Convex document id, or a 400. This is a shape
 * guard, not a full validator — Convex stays the authority — but it lets a
 * malformed id fail here instead of as a 500 after Convex rejects the argument.
 *
 * @template {string} T
 * @param {string} value
 * @returns {T}
 */
export function requireConvexId(value) {
	if (!CONVEX_ID.test(value)) throw error(400, 'Invalid id');
	return /** @type {T} */ (value);
}

const convexId = z.string().regex(CONVEX_ID, 'Invalid id');

/**
 * A Zod refinement from one of the comment rules, which return why a value is
 * refused or null.
 *
 * @param {(value: string) => string | null} check
 */
const rule =
	(check) => (/** @type {string} */ value, /** @type {import('zod').RefinementCtx} */ ctx) => {
		const message = check(value);
		if (message) ctx.addIssue({ code: 'custom', message });
	};

// Trimmed first so the rules judge what actually gets stored. The rules are the
// ones `comments.create` enforces again on its own side.
const commentText = z.string().trim().superRefine(rule(commentTextError));

export const createCommentSchema = z.object({
	url: z.string().min(1),
	username: z.string().trim().superRefine(rule(usernameError)).default(''),
	password: z
		.string()
		.min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
	text: commentText,
	parentId: convexId.optional()
});

// These verify a password that was created with the minimum length, so only a
// non-empty value is required.
const existingPassword = z.string().min(1, 'Password is required');

export const editCommentSchema = z.object({
	text: commentText,
	password: existingPassword
});

export const deleteCommentSchema = z.object({
	password: existingPassword
});

export const voteSchema = z.object({
	voteType: z.enum(['up', 'down'])
});

export const likeSchema = z.object({
	url: z.string().min(1),
	liked: z.boolean()
});

export const replySchema = z.object({
	reply: z.string().max(MAX_REPLY_LENGTH)
});

export const nowSchema = z.object({
	content: z.string().max(20000, 'Content must be 20000 characters or less')
});

export const banSchema = z.object({
	commentId: convexId,
	reason: z.string().max(500).optional()
});

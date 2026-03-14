import { describe, it, expect } from 'vitest';
import {
	createCommentSchema,
	editCommentSchema,
	voteSchema,
	likeSchema,
	replySchema,
	banSchema
} from './validation.js';

// ─── createCommentSchema ─────────────────────────────────────────────────────

describe('createCommentSchema', () => {
	const valid = {
		url: '/blog/hello',
		username: 'Alice',
		password: 'pass1234',
		text: 'Hello world'
	};

	it('accepts valid input', () => {
		expect(createCommentSchema.safeParse(valid).success).toBe(true);
	});

	it('defaults username to "Anonymous" when omitted', () => {
		const { username, ...rest } = valid;
		const result = createCommentSchema.safeParse(rest);
		expect(result.success).toBe(true);
		expect(result.data.username).toBe('Anonymous');
	});

	it('rejects empty url', () => {
		expect(createCommentSchema.safeParse({ ...valid, url: '' }).success).toBe(false);
	});

	it('rejects username longer than 32 characters', () => {
		expect(
			createCommentSchema.safeParse({ ...valid, username: 'a'.repeat(33) }).success
		).toBe(false);
	});

	it('accepts username exactly 32 characters', () => {
		expect(
			createCommentSchema.safeParse({ ...valid, username: 'a'.repeat(32) }).success
		).toBe(true);
	});

	it('rejects password shorter than 4 characters', () => {
		expect(createCommentSchema.safeParse({ ...valid, password: 'abc' }).success).toBe(false);
	});

	it('rejects empty text', () => {
		expect(createCommentSchema.safeParse({ ...valid, text: '' }).success).toBe(false);
	});

	it('rejects text longer than 200 characters', () => {
		expect(
			createCommentSchema.safeParse({ ...valid, text: 'a'.repeat(201) }).success
		).toBe(false);
	});

	it('accepts text exactly 200 characters', () => {
		expect(
			createCommentSchema.safeParse({ ...valid, text: 'a'.repeat(200) }).success
		).toBe(true);
	});

	it('trims whitespace from text', () => {
		const result = createCommentSchema.safeParse({ ...valid, text: '  hello  ' });
		expect(result.success).toBe(true);
		expect(result.data.text).toBe('hello');
	});

	it('accepts valid UUID parentId', () => {
		const result = createCommentSchema.safeParse({
			...valid,
			parentId: '550e8400-e29b-41d4-a716-446655440000'
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUID parentId', () => {
		expect(
			createCommentSchema.safeParse({ ...valid, parentId: 'not-a-uuid' }).success
		).toBe(false);
	});
});

// ─── editCommentSchema ───────────────────────────────────────────────────────

describe('editCommentSchema', () => {
	it('accepts valid input', () => {
		expect(
			editCommentSchema.safeParse({ text: 'Updated text', password: 'pass' }).success
		).toBe(true);
	});

	it('rejects empty text', () => {
		expect(editCommentSchema.safeParse({ text: '', password: 'pass' }).success).toBe(false);
	});

	it('rejects text over 200 characters', () => {
		expect(
			editCommentSchema.safeParse({ text: 'a'.repeat(201), password: 'pass' }).success
		).toBe(false);
	});

	it('rejects empty password', () => {
		expect(editCommentSchema.safeParse({ text: 'hello', password: '' }).success).toBe(false);
	});

	it('trims whitespace from text', () => {
		const result = editCommentSchema.safeParse({ text: '  hi  ', password: 'pw' });
		expect(result.success).toBe(true);
		expect(result.data.text).toBe('hi');
	});
});

// ─── voteSchema ──────────────────────────────────────────────────────────────

describe('voteSchema', () => {
	it('accepts "up"', () => {
		expect(voteSchema.safeParse({ voteType: 'up' }).success).toBe(true);
	});

	it('accepts "down"', () => {
		expect(voteSchema.safeParse({ voteType: 'down' }).success).toBe(true);
	});

	it('rejects arbitrary strings', () => {
		expect(voteSchema.safeParse({ voteType: 'sideways' }).success).toBe(false);
	});

	it('rejects missing voteType', () => {
		expect(voteSchema.safeParse({}).success).toBe(false);
	});
});

// ─── likeSchema ──────────────────────────────────────────────────────────────

describe('likeSchema', () => {
	it('accepts a valid url', () => {
		expect(likeSchema.safeParse({ url: '/projects/foo' }).success).toBe(true);
	});

	it('rejects empty url', () => {
		expect(likeSchema.safeParse({ url: '' }).success).toBe(false);
	});

	it('rejects missing url', () => {
		expect(likeSchema.safeParse({}).success).toBe(false);
	});
});

// ─── replySchema ─────────────────────────────────────────────────────────────

describe('replySchema', () => {
	it('accepts a short reply', () => {
		expect(replySchema.safeParse({ reply: 'Thanks!' }).success).toBe(true);
	});

	it('accepts an empty reply (clears the reply)', () => {
		expect(replySchema.safeParse({ reply: '' }).success).toBe(true);
	});

	it('accepts reply exactly 1000 characters', () => {
		expect(replySchema.safeParse({ reply: 'a'.repeat(1000) }).success).toBe(true);
	});

	it('rejects reply over 1000 characters', () => {
		expect(replySchema.safeParse({ reply: 'a'.repeat(1001) }).success).toBe(false);
	});
});

// ─── banSchema ───────────────────────────────────────────────────────────────

describe('banSchema', () => {
	const validUuid = '550e8400-e29b-41d4-a716-446655440000';

	it('accepts valid commentId without reason', () => {
		expect(banSchema.safeParse({ commentId: validUuid }).success).toBe(true);
	});

	it('accepts valid commentId with reason', () => {
		expect(banSchema.safeParse({ commentId: validUuid, reason: 'spam' }).success).toBe(true);
	});

	it('rejects non-UUID commentId', () => {
		expect(banSchema.safeParse({ commentId: 'not-a-uuid' }).success).toBe(false);
	});

	it('rejects reason over 500 characters', () => {
		expect(
			banSchema.safeParse({ commentId: validUuid, reason: 'x'.repeat(501) }).success
		).toBe(false);
	});

	it('accepts reason exactly 500 characters', () => {
		expect(
			banSchema.safeParse({ commentId: validUuid, reason: 'x'.repeat(500) }).success
		).toBe(true);
	});
});

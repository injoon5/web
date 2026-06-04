import { describe, it, expect } from 'vitest';
import {
	createCommentSchema,
	editCommentSchema,
	deleteCommentSchema,
	voteSchema,
	likeSchema,
	replySchema,
	nowSchema,
	banSchema
} from './validation';

describe('createCommentSchema', () => {
	const base = {
		url: '/blog/hello',
		username: 'alice',
		password: 'hunter2',
		text: 'nice post'
	};

	it('accepts a valid comment', () => {
		const parsed = createCommentSchema.parse(base);
		expect(parsed.url).toBe('/blog/hello');
		expect(parsed.text).toBe('nice post');
	});

	it('defaults username to Anonymous when omitted', () => {
		const parsed = createCommentSchema.parse({
			url: base.url,
			password: base.password,
			text: base.text
		});
		expect(parsed.username).toBe('Anonymous');
	});

	it('rejects an empty url', () => {
		expect(createCommentSchema.safeParse({ ...base, url: '' }).success).toBe(false);
	});

	it('rejects a username over 32 chars', () => {
		expect(createCommentSchema.safeParse({ ...base, username: 'a'.repeat(33) }).success).toBe(
			false
		);
		expect(createCommentSchema.safeParse({ ...base, username: 'a'.repeat(32) }).success).toBe(true);
	});

	it('requires a password of at least 4 chars', () => {
		expect(createCommentSchema.safeParse({ ...base, password: 'abc' }).success).toBe(false);
		expect(createCommentSchema.safeParse({ ...base, password: 'abcd' }).success).toBe(true);
	});

	it('rejects empty text and text over 200 chars', () => {
		expect(createCommentSchema.safeParse({ ...base, text: '' }).success).toBe(false);
		expect(createCommentSchema.safeParse({ ...base, text: 'a'.repeat(201) }).success).toBe(false);
		expect(createCommentSchema.safeParse({ ...base, text: 'a'.repeat(200) }).success).toBe(true);
	});

	it('trims surrounding whitespace from text', () => {
		expect(createCommentSchema.parse({ ...base, text: '  hi  ' }).text).toBe('hi');
	});

	it('treats parentId as optional', () => {
		expect(createCommentSchema.parse(base).parentId).toBeUndefined();
		expect(createCommentSchema.parse({ ...base, parentId: 'abc123' }).parentId).toBe('abc123');
	});
});

describe('editCommentSchema', () => {
	it('requires non-empty text and a non-empty password', () => {
		expect(editCommentSchema.safeParse({ text: 'updated', password: 'x' }).success).toBe(true);
		expect(editCommentSchema.safeParse({ text: 'updated', password: '' }).success).toBe(false);
		expect(editCommentSchema.safeParse({ text: '', password: 'x' }).success).toBe(false);
	});

	it('accepts a single-char password (verifies, does not create)', () => {
		expect(editCommentSchema.safeParse({ text: 'ok', password: 'a' }).success).toBe(true);
	});
});

describe('deleteCommentSchema', () => {
	it('requires a non-empty password', () => {
		expect(deleteCommentSchema.safeParse({ password: 'x' }).success).toBe(true);
		expect(deleteCommentSchema.safeParse({ password: '' }).success).toBe(false);
	});
});

describe('voteSchema', () => {
	it('accepts only up or down', () => {
		expect(voteSchema.safeParse({ voteType: 'up' }).success).toBe(true);
		expect(voteSchema.safeParse({ voteType: 'down' }).success).toBe(true);
		expect(voteSchema.safeParse({ voteType: 'sideways' }).success).toBe(false);
	});
});

describe('likeSchema', () => {
	it('requires a url and treats liked as optional boolean', () => {
		expect(likeSchema.safeParse({ url: '/blog/x' }).success).toBe(true);
		expect(likeSchema.safeParse({ url: '/blog/x', liked: true }).success).toBe(true);
		expect(likeSchema.safeParse({ url: '' }).success).toBe(false);
		expect(likeSchema.safeParse({ url: '/x', liked: 'yes' }).success).toBe(false);
	});
});

describe('replySchema', () => {
	it('caps reply length at 1000 chars', () => {
		expect(replySchema.safeParse({ reply: '' }).success).toBe(true);
		expect(replySchema.safeParse({ reply: 'a'.repeat(1000) }).success).toBe(true);
		expect(replySchema.safeParse({ reply: 'a'.repeat(1001) }).success).toBe(false);
	});
});

describe('nowSchema', () => {
	it('caps content length at 20000 chars and requires a string', () => {
		expect(nowSchema.safeParse({ content: '' }).success).toBe(true);
		expect(nowSchema.safeParse({ content: 'a'.repeat(20000) }).success).toBe(true);
		expect(nowSchema.safeParse({ content: 'a'.repeat(20001) }).success).toBe(false);
		expect(nowSchema.safeParse({ content: 123 }).success).toBe(false);
		expect(nowSchema.safeParse({}).success).toBe(false);
	});
});

describe('banSchema', () => {
	it('requires a commentId and treats reason as optional with a 500 cap', () => {
		expect(banSchema.safeParse({ commentId: 'c1' }).success).toBe(true);
		expect(banSchema.safeParse({ commentId: 'c1', reason: 'spam' }).success).toBe(true);
		expect(banSchema.safeParse({ commentId: '' }).success).toBe(false);
		expect(banSchema.safeParse({ commentId: 'c1', reason: 'a'.repeat(501) }).success).toBe(false);
	});
});

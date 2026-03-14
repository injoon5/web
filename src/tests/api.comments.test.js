/**
 * Tests for /api/comments (GET + POST) and /api/comments/[id] (PATCH + DELETE)
 *
 * All external side-effects (DB, Redis, bcrypt) are mocked so these run
 * without a real database or Redis instance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared chain helper ─────────────────────────────────────────────────────
// Returns a Proxy that is both callable and thenable, mimicking Drizzle's
// fluent query-builder API. Every method call returns the same proxy; the
// proxy resolves to `result` when awaited.
function chain(result = []) {
	const proxy = new Proxy(function () {}, {
		apply: () => proxy,
		get: (_, prop) => {
			if (prop === 'then') return (res, rej) => Promise.resolve(result).then(res, rej);
			if (prop === 'catch') return (rej) => Promise.resolve(result).catch(rej);
			return () => proxy;
		}
	});
	return proxy;
}

// ─── Hoist mock state so vi.mock factories can reference it ──────────────────
const mocks = vi.hoisted(() => {
	const db = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		execute: vi.fn()
	};
	const commentRatelimit = { limit: vi.fn() };
	const editRatelimit = { limit: vi.fn() };
	const voteRatelimit = { limit: vi.fn() };
	const bcrypt = { hash: vi.fn(), compare: vi.fn() };
	const ip = { getClientIp: vi.fn(() => '1.2.3.4'), hashIp: vi.fn(() => 'hashed-ip') };
	const admin = { verifyAdminSecret: vi.fn(() => false) };
	return { db, commentRatelimit, editRatelimit, voteRatelimit, bcrypt, ip, admin };
});

vi.mock('$lib/server/db', () => ({ db: mocks.db }));
vi.mock('$lib/server/db/schema', () => ({
	comments: {},
	commentVotes: {},
	bannedIps: {}
}));
vi.mock('$lib/server/redis', () => ({
	commentRatelimit: mocks.commentRatelimit,
	editRatelimit: mocks.editRatelimit,
	voteRatelimit: mocks.voteRatelimit
}));
vi.mock('$lib/server/ip', () => ({
	getClientIp: mocks.ip.getClientIp,
	hashIp: mocks.ip.hashIp
}));
vi.mock('$lib/server/admin', () => ({
	verifyAdminSecret: mocks.admin.verifyAdminSecret
}));
vi.mock('bcryptjs', () => ({ default: mocks.bcrypt }));
vi.mock('$env/static/private', () => ({ ADMIN_SECRET: 'secret' }));
// drizzle-orm operators used by routes – just return their first arg so they're passable
vi.mock('drizzle-orm', async (importOriginal) => {
	const real = await importOriginal();
	return { ...real };
});

const { GET: commentsGET, POST: commentsPOST } = await import(
	'../routes/api/comments/+server.js'
);
const { PATCH: commentPATCH, DELETE: commentDELETE } = await import(
	'../routes/api/comments/[id]/+server.js'
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(method = 'GET', body = null, headers = {}) {
	const init = { method, headers: new Headers(headers) };
	if (body) init.body = JSON.stringify(body);
	return new Request('http://localhost/api/comments', init);
}

function makeEvent(overrides = {}) {
	return {
		url: new URL('http://localhost/api/comments?url=/blog/post'),
		request: makeRequest(),
		params: {},
		...overrides
	};
}

// ─── GET /api/comments ───────────────────────────────────────────────────────

describe('GET /api/comments', () => {
	beforeEach(() => {
		mocks.db.select.mockReturnValue(chain([]));
	});

	it('returns 400 when url query param is missing', async () => {
		const event = makeEvent({ url: new URL('http://localhost/api/comments') });
		await expect(commentsGET(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns comments array on success', async () => {
		const fakeComments = [
			{ id: 'abc', username: 'Alice', text: 'Hi', upvotes: 1, downvotes: 0 }
		];
		mocks.db.select.mockReturnValue(chain(fakeComments));

		const event = makeEvent();
		const res = await commentsGET(event);
		const data = await res.json();
		expect(res.status).toBe(200);
		expect(data.comments).toEqual(fakeComments);
	});

	it('returns empty comments array when no comments exist', async () => {
		mocks.db.select.mockReturnValue(chain([]));
		const res = await commentsGET(makeEvent());
		const data = await res.json();
		expect(data.comments).toEqual([]);
	});
});

// ─── POST /api/comments ──────────────────────────────────────────────────────

describe('POST /api/comments', () => {
	const validBody = {
		url: '/blog/post',
		username: 'Bob',
		password: 'pass1234',
		text: 'Great post!'
	};

	beforeEach(() => {
		// By default: not banned, rate limit passes
		mocks.db.select.mockReturnValue(chain([])); // no ban
		mocks.commentRatelimit.limit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
		mocks.bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword');
		mocks.db.insert.mockReturnValue(chain([{ id: 'new-id', ...validBody, reply: null, parentId: null, depth: 0, createdAt: new Date(), updatedAt: new Date() }]));
		mocks.admin.verifyAdminSecret.mockReturnValue(false);
	});

	it('returns 400 when body is invalid (missing url)', async () => {
		const req = new Request('http://localhost/api/comments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'Bob', password: 'pass', text: 'hi' })
		});
		await expect(commentsPOST({ request: req })).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when password is too short', async () => {
		const req = new Request('http://localhost/api/comments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...validBody, password: 'ab' })
		});
		await expect(commentsPOST({ request: req })).rejects.toMatchObject({ status: 400 });
	});

	it('returns 403 when IP is banned', async () => {
		mocks.db.select.mockReturnValue(chain([{ id: 'ban-1', ipHash: 'hashed-ip' }]));
		const req = new Request('http://localhost/api/comments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody)
		});
		await expect(commentsPOST({ request: req })).rejects.toMatchObject({ status: 403 });
	});

	it('returns 429 when rate limit is exceeded', async () => {
		mocks.db.select.mockReturnValue(chain([])); // not banned
		mocks.commentRatelimit.limit.mockResolvedValue({ success: false, reset: Date.now() + 60000 });
		const req = new Request('http://localhost/api/comments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody)
		});
		const res = await commentsPOST({ request: req });
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toBeTruthy();
	});

	it('skips rate limiting for admin requests', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		// Even if limit would fail, admin bypasses it
		mocks.commentRatelimit.limit.mockResolvedValue({ success: false, reset: Date.now() });
		const req = new Request('http://localhost/api/comments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'secret' },
			body: JSON.stringify(validBody)
		});
		const res = await commentsPOST({ request: req });
		// Admin bypasses rate limit → should succeed (201)
		expect(res.status).toBe(201);
		// Rate limiter should never have been consulted
		expect(mocks.commentRatelimit.limit).not.toHaveBeenCalled();
	});

	it('creates comment and returns 201 on valid input', async () => {
		const req = new Request('http://localhost/api/comments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody)
		});
		const res = await commentsPOST({ request: req });
		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.comment).toBeDefined();
	});
});

// ─── PATCH /api/comments/[id] ────────────────────────────────────────────────

describe('PATCH /api/comments/[id]', () => {
	const commentId = '550e8400-e29b-41d4-a716-446655440000';
	const fakeComment = { id: commentId, text: 'old text', passwordHash: '$2b$10$hash', deletedAt: null };

	beforeEach(() => {
		mocks.editRatelimit.limit.mockResolvedValue({ success: true });
		mocks.admin.verifyAdminSecret.mockReturnValue(false);
		mocks.db.select.mockReturnValue(chain([fakeComment]));
		mocks.bcrypt.compare.mockResolvedValue(true);
		mocks.db.update.mockReturnValue(chain([{ id: commentId, text: 'new text', updatedAt: new Date() }]));
	});

	it('returns 400 for invalid body', async () => {
		const req = new Request('http://localhost', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: '', password: 'pass' }) // empty text is invalid
		});
		await expect(commentPATCH({ params: { id: commentId }, request: req })).rejects.toMatchObject({ status: 400 });
	});

	it('returns 404 when comment does not exist', async () => {
		mocks.db.select.mockReturnValue(chain([]));
		const req = new Request('http://localhost', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: 'Updated', password: 'pass' })
		});
		await expect(commentPATCH({ params: { id: commentId }, request: req })).rejects.toMatchObject({ status: 404 });
	});

	it('returns 401 when password is wrong', async () => {
		mocks.bcrypt.compare.mockResolvedValue(false);
		const req = new Request('http://localhost', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: 'Updated', password: 'wrong' })
		});
		await expect(commentPATCH({ params: { id: commentId }, request: req })).rejects.toMatchObject({ status: 401 });
	});

	it('updates comment and returns 200 on success', async () => {
		const req = new Request('http://localhost', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: 'Updated text', password: 'pass' })
		});
		const res = await commentPATCH({ params: { id: commentId }, request: req });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.comment).toBeDefined();
	});

	it('returns 429 when rate limit exceeded', async () => {
		mocks.editRatelimit.limit.mockResolvedValue({ success: false });
		const req = new Request('http://localhost', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: 'Updated', password: 'pass' })
		});
		await expect(commentPATCH({ params: { id: commentId }, request: req })).rejects.toMatchObject({ status: 429 });
	});
});

// ─── DELETE /api/comments/[id] ───────────────────────────────────────────────

describe('DELETE /api/comments/[id]', () => {
	const commentId = '550e8400-e29b-41d4-a716-446655440000';
	const fakeComment = { id: commentId, text: 'hello', passwordHash: '$2b$10$hash', deletedAt: null };

	beforeEach(() => {
		mocks.admin.verifyAdminSecret.mockReturnValue(false);
		mocks.editRatelimit.limit.mockResolvedValue({ success: true });
		mocks.db.select.mockReturnValue(chain([fakeComment]));
		mocks.db.update.mockReturnValue(chain([]));
		mocks.bcrypt.compare.mockResolvedValue(true);
	});

	it('hard-deletes (sets deletedAt) when admin secret is present', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		const req = new Request('http://localhost', {
			method: 'DELETE',
			headers: { 'x-admin-secret': 'secret' }
		});
		const res = await commentDELETE({ params: { id: commentId }, request: req });
		expect(res.status).toBe(200);
		expect(mocks.db.update).toHaveBeenCalled();
	});

	it('returns 400 when user provides no body', async () => {
		const req = new Request('http://localhost', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' }
			// no body
		});
		await expect(commentDELETE({ params: { id: commentId }, request: req })).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when password is too short', async () => {
		const req = new Request('http://localhost', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: 'ab' })
		});
		await expect(commentDELETE({ params: { id: commentId }, request: req })).rejects.toMatchObject({ status: 400 });
	});

	it('returns 404 when comment does not exist (user path)', async () => {
		mocks.db.select.mockReturnValue(chain([]));
		const req = new Request('http://localhost', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: 'validpass' })
		});
		await expect(commentDELETE({ params: { id: commentId }, request: req })).rejects.toMatchObject({ status: 404 });
	});

	it('returns 401 when user password is wrong', async () => {
		mocks.bcrypt.compare.mockResolvedValue(false);
		const req = new Request('http://localhost', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: 'wrongpass' })
		});
		await expect(commentDELETE({ params: { id: commentId }, request: req })).rejects.toMatchObject({ status: 401 });
	});

	it('soft-deletes (sets [deleted]) when user provides correct password', async () => {
		const req = new Request('http://localhost', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: 'correctpass' })
		});
		const res = await commentDELETE({ params: { id: commentId }, request: req });
		expect(res.status).toBe(200);
		expect(mocks.db.update).toHaveBeenCalled();
	});
});

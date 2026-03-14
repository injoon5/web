/**
 * Tests for admin API routes:
 *   GET /api/admin/comments
 *   GET /api/admin/bans
 *   POST /api/admin/bans
 *   DELETE /api/admin/bans/[id]
 *   POST /api/admin/comments/[id]  (set reply)
 *   DELETE /api/admin/comments/[id]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mocks = vi.hoisted(() => {
	const db = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn()
	};
	const admin = { verifyAdminSecret: vi.fn() };
	return { db, admin };
});

vi.mock('$lib/server/db', () => ({ db: mocks.db }));
vi.mock('$lib/server/db/schema', () => ({
	comments: {},
	commentVotes: {},
	bannedIps: {}
}));
vi.mock('$lib/server/admin', () => ({ verifyAdminSecret: mocks.admin.verifyAdminSecret }));
vi.mock('$env/static/private', () => ({ ADMIN_SECRET: 'secret' }));

const { GET: adminCommentsGET } = await import('../routes/api/admin/comments/+server.js');
const { POST: adminCommentPOST, DELETE: adminCommentDELETE } = await import(
	'../routes/api/admin/comments/[id]/+server.js'
);
const { GET: adminBansGET, POST: adminBansPOST } = await import(
	'../routes/api/admin/bans/+server.js'
);
const { DELETE: adminBanDELETE } = await import('../routes/api/admin/bans/[id]/+server.js');

// ─── GET /api/admin/comments ──────────────────────────────────────────────────

describe('GET /api/admin/comments', () => {
	it('returns 401 when no admin secret', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(false);
		const event = {
			request: new Request('http://localhost'),
			url: new URL('http://localhost/api/admin/comments')
		};
		await expect(adminCommentsGET(event)).rejects.toMatchObject({ status: 401 });
	});

	it('returns list of URLs with comment counts when no url param', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		const rows = [{ url: '/blog/post', count: 3 }];
		mocks.db.select.mockReturnValue(chain(rows));
		const event = {
			request: new Request('http://localhost', { headers: { 'x-admin-secret': 'secret' } }),
			url: new URL('http://localhost/api/admin/comments')
		};
		const res = await adminCommentsGET(event);
		const data = await res.json();
		expect(data.urls).toEqual(rows);
	});

	it('returns comments for a specific URL when url param is provided', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		const rows = [{ id: 'c1', url: '/blog/post', username: 'Alice', text: 'hi', ipHash: 'abc' }];
		mocks.db.select.mockReturnValue(chain(rows));
		const event = {
			request: new Request('http://localhost', { headers: { 'x-admin-secret': 'secret' } }),
			url: new URL('http://localhost/api/admin/comments?url=/blog/post')
		};
		const res = await adminCommentsGET(event);
		const data = await res.json();
		expect(data.comments).toEqual(rows);
	});
});

// ─── POST /api/admin/comments/[id] (set reply) ───────────────────────────────

describe('POST /api/admin/comments/[id]', () => {
	it('returns 401 when no admin secret', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(false);
		const req = new Request('http://localhost', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reply: 'Thanks!' })
		});
		await expect(adminCommentPOST({ params: { id: 'c1' }, request: req })).rejects.toMatchObject({
			status: 401
		});
	});

	it('sets reply and returns 200', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		mocks.db.update.mockReturnValue(chain([{ id: 'c1', reply: 'Thanks!' }]));
		const req = new Request('http://localhost', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'secret' },
			body: JSON.stringify({ reply: 'Thanks!' })
		});
		const res = await adminCommentPOST({ params: { id: 'c1' }, request: req });
		expect(res.status).toBe(200);
	});

	it('returns 400 when reply is not a string', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		mocks.db.update.mockReturnValue(chain([]));
		const req = new Request('http://localhost', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'secret' },
			body: JSON.stringify({ reply: 42 }) // number instead of string
		});
		await expect(adminCommentPOST({ params: { id: 'c1' }, request: req })).rejects.toMatchObject({
			status: 400
		});
	});

	it('clears reply when empty string is provided', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		mocks.db.update.mockReturnValue(chain([{ id: 'c1', reply: null }]));
		const req = new Request('http://localhost', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'secret' },
			body: JSON.stringify({ reply: '' })
		});
		const res = await adminCommentPOST({ params: { id: 'c1' }, request: req });
		expect(res.status).toBe(200);
	});
});

// ─── DELETE /api/admin/comments/[id] ─────────────────────────────────────────

describe('DELETE /api/admin/comments/[id]', () => {
	it('returns 401 when no admin secret', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(false);
		const req = new Request('http://localhost', { method: 'DELETE' });
		await expect(adminCommentDELETE({ params: { id: 'c1' }, request: req, url: new URL('http://localhost') })).rejects.toMatchObject({ status: 401 });
	});

	it('soft-deletes when ?soft=1 is present', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		mocks.db.update.mockReturnValue(chain([]));
		const req = new Request('http://localhost', {
			method: 'DELETE',
			headers: { 'x-admin-secret': 'secret' }
		});
		const res = await adminCommentDELETE({
			params: { id: 'c1' },
			request: req,
			url: new URL('http://localhost?soft=1')
		});
		expect(res.status).toBe(200);
		expect(mocks.db.update).toHaveBeenCalled();
	});

	it('hard-deletes (sets deletedAt) without ?soft param', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		mocks.db.update.mockReturnValue(chain([]));
		const req = new Request('http://localhost', {
			method: 'DELETE',
			headers: { 'x-admin-secret': 'secret' }
		});
		const res = await adminCommentDELETE({
			params: { id: 'c1' },
			request: req,
			url: new URL('http://localhost')
		});
		expect(res.status).toBe(200);
	});
});

// ─── GET /api/admin/bans ──────────────────────────────────────────────────────

describe('GET /api/admin/bans', () => {
	it('returns 401 when no admin secret', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(false);
		await expect(adminBansGET({ request: new Request('http://localhost') })).rejects.toMatchObject({
			status: 401
		});
	});

	it('returns list of bans', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		const bans = [{ id: 'b1', ipHash: 'abc', reason: 'spam', createdAt: '2024-01-01T00:00:00.000Z' }];
		mocks.db.select.mockReturnValue(chain(bans));
		const res = await adminBansGET({
			request: new Request('http://localhost', { headers: { 'x-admin-secret': 'secret' } })
		});
		const data = await res.json();
		expect(data.bans).toEqual(bans);
	});
});

// ─── POST /api/admin/bans ─────────────────────────────────────────────────────

describe('POST /api/admin/bans', () => {
	const validUuid = '550e8400-e29b-41d4-a716-446655440000';

	beforeEach(() => {
		mocks.db.select.mockReturnValue(chain([{ ipHash: 'target-ip-hash' }]));
		mocks.db.insert.mockReturnValue(chain([{ id: 'new-ban', ipHash: 'target-ip-hash', reason: null }]));
	});

	it('returns 401 when no admin secret', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(false);
		const req = new Request('http://localhost', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ commentId: validUuid })
		});
		await expect(adminBansPOST({ request: req })).rejects.toMatchObject({ status: 401 });
	});

	it('returns 400 when commentId is not a UUID', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		const req = new Request('http://localhost', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'secret' },
			body: JSON.stringify({ commentId: 'not-a-uuid' })
		});
		await expect(adminBansPOST({ request: req })).rejects.toMatchObject({ status: 400 });
	});

	it('returns 404 when comment not found', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		mocks.db.select.mockReturnValue(chain([]));
		const req = new Request('http://localhost', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'secret' },
			body: JSON.stringify({ commentId: validUuid })
		});
		await expect(adminBansPOST({ request: req })).rejects.toMatchObject({ status: 404 });
	});

	it('creates a ban and returns 201', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		const req = new Request('http://localhost', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'secret' },
			body: JSON.stringify({ commentId: validUuid, reason: 'spammer' })
		});
		const res = await adminBansPOST({ request: req });
		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.ban).toBeDefined();
	});
});

// ─── DELETE /api/admin/bans/[id] ─────────────────────────────────────────────

describe('DELETE /api/admin/bans/[id]', () => {
	it('returns 401 when no admin secret', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(false);
		const req = new Request('http://localhost', { method: 'DELETE' });
		await expect(adminBanDELETE({ params: { id: 'b1' }, request: req })).rejects.toMatchObject({
			status: 401
		});
	});

	it('deletes ban and returns 200', async () => {
		mocks.admin.verifyAdminSecret.mockReturnValue(true);
		mocks.db.delete.mockReturnValue(chain([]));
		const req = new Request('http://localhost', {
			method: 'DELETE',
			headers: { 'x-admin-secret': 'secret' }
		});
		const res = await adminBanDELETE({ params: { id: 'b1' }, request: req });
		expect(res.status).toBe(200);
		expect(mocks.db.delete).toHaveBeenCalled();
	});
});

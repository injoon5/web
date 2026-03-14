/**
 * Tests for /api/likes (GET + POST)
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
		delete: vi.fn()
	};
	const likeRatelimit = { limit: vi.fn() };
	const ip = { getClientIp: vi.fn(() => '5.5.5.5'), hashIp: vi.fn(() => 'hashed-5') };
	return { db, likeRatelimit, ip };
});

vi.mock('$lib/server/db', () => ({ db: mocks.db }));
vi.mock('$lib/server/db/schema', () => ({ likes: {}, bannedIps: {} }));
vi.mock('$lib/server/redis', () => ({ likeRatelimit: mocks.likeRatelimit }));
vi.mock('$lib/server/ip', () => ({ getClientIp: mocks.ip.getClientIp, hashIp: mocks.ip.hashIp }));
vi.mock('$env/static/private', () => ({ ADMIN_SECRET: 'secret' }));

const { GET: likesGET, POST: likesPOST } = await import('../routes/api/likes/+server.js');

// ─── GET /api/likes ───────────────────────────────────────────────────────────

describe('GET /api/likes', () => {
	beforeEach(() => {
		mocks.db.select.mockReturnValue(chain([{ count: 3, liked: false }]));
	});

	it('returns 400 when url param is missing', async () => {
		const event = {
			url: new URL('http://localhost/api/likes'),
			request: new Request('http://localhost/api/likes')
		};
		await expect(likesGET(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns count and liked status', async () => {
		mocks.db.select.mockReturnValue(chain([{ count: 5, liked: true }]));
		const event = {
			url: new URL('http://localhost/api/likes?url=/blog/post'),
			request: new Request('http://localhost/api/likes')
		};
		const res = await likesGET(event);
		const data = await res.json();
		expect(data.count).toBe(5);
		expect(data.liked).toBe(true);
	});

	it('returns count 0 and liked false when no likes', async () => {
		mocks.db.select.mockReturnValue(chain([{ count: 0, liked: false }]));
		const event = {
			url: new URL('http://localhost/api/likes?url=/blog/new'),
			request: new Request('http://localhost/api/likes')
		};
		const res = await likesGET(event);
		const data = await res.json();
		expect(data.count).toBe(0);
		expect(data.liked).toBe(false);
	});
});

// ─── POST /api/likes ──────────────────────────────────────────────────────────

describe('POST /api/likes', () => {
	const validBody = { url: '/blog/post' };

	beforeEach(() => {
		mocks.db.insert.mockReturnValue(chain([]));
		mocks.db.delete.mockReturnValue(chain([]));
	});

	it('returns 403 when IP is banned', async () => {
		mocks.db.select.mockReturnValue(chain([{ id: 'ban' }]));
		const req = new Request('http://localhost/api/likes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody)
		});
		await expect(likesPOST({ request: req })).rejects.toMatchObject({ status: 403 });
	});

	it('returns 429 when rate limited', async () => {
		mocks.db.select
			.mockReturnValueOnce(chain([]))  // ban check → not banned
			.mockReturnValue(chain([]));
		mocks.likeRatelimit.limit.mockResolvedValue({ success: false });
		const req = new Request('http://localhost/api/likes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody)
		});
		await expect(likesPOST({ request: req })).rejects.toMatchObject({ status: 429 });
	});

	it('returns 400 when url is missing', async () => {
		mocks.db.select.mockReturnValueOnce(chain([])); // ban check → not banned
		mocks.likeRatelimit.limit.mockResolvedValue({ success: true });
		const req = new Request('http://localhost/api/likes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});
		await expect(likesPOST({ request: req })).rejects.toMatchObject({ status: 400 });
	});

	it('toggles a like on (inserts) when not previously liked', async () => {
		mocks.db.select
			.mockReturnValueOnce(chain([]))                       // ban check → not banned
			.mockReturnValueOnce(chain([]))                       // existing like → none
			.mockReturnValue(chain([{ count: 1, liked: true }])); // result count
		mocks.likeRatelimit.limit.mockResolvedValue({ success: true });
		const req = new Request('http://localhost/api/likes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody)
		});
		const res = await likesPOST({ request: req });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.liked).toBe(true);
		expect(mocks.db.insert).toHaveBeenCalled();
	});

	it('toggles a like off (deletes) when previously liked', async () => {
		mocks.db.select
			.mockReturnValueOnce(chain([]))                          // ban check → not banned
			.mockReturnValueOnce(chain([{ id: 'existing-like' }]))  // existing like → found
			.mockReturnValue(chain([{ count: 0, liked: false }]));  // result count
		mocks.likeRatelimit.limit.mockResolvedValue({ success: true });
		const req = new Request('http://localhost/api/likes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody)
		});
		const res = await likesPOST({ request: req });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.liked).toBe(false);
		expect(mocks.db.delete).toHaveBeenCalled();
	});
});

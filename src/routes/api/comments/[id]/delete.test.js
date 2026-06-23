import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ADMIN_SECRET } from '$env/static/private';
import { createAdminSessionToken } from '$lib/server/admin';
import { api } from '$convex/_generated/api';

const convexAction = vi.fn(async () => ({ success: true }));
const convexMutation = vi.fn(async () => undefined);

vi.mock('$lib/server/convex', () => ({
	convex: {
		action: (...args) => convexAction(...args),
		mutation: (...args) => convexMutation(...args)
	}
}));

const { DELETE } = await import('./+server.ts');

function deleteRequest({ password = 'secret', cookie } = {}) {
	const headers = { 'Content-Type': 'application/json' };
	if (cookie) headers.cookie = cookie;
	return new Request('http://localhost/api/comments/comment123', {
		method: 'DELETE',
		headers,
		body: JSON.stringify({ password })
	});
}

describe('DELETE /api/comments/[id]', () => {
	beforeEach(() => {
		convexAction.mockClear();
		convexMutation.mockClear();
	});

	it('soft-deletes for a normal visitor (password required)', async () => {
		const res = await DELETE({
			params: { id: 'comment123' },
			request: deleteRequest({ password: 'mypass' })
		});

		expect(res.status).toBe(200);
		expect(convexAction).toHaveBeenCalledTimes(1);
		expect(convexAction).toHaveBeenCalledWith(api.commentActions.softDeleteComment, {
			commentId: 'comment123',
			password: 'mypass',
			ipHash: expect.any(String),
			adminSecret: undefined
		});
		expect(convexMutation).not.toHaveBeenCalled();
	});

	it('soft-deletes when admin_token cookie is present (does not hard-delete)', async () => {
		const token = createAdminSessionToken();
		const res = await DELETE({
			params: { id: 'comment123' },
			request: deleteRequest({ cookie: `admin_token=${encodeURIComponent(token)}` })
		});

		expect(res.status).toBe(200);
		expect(convexAction).toHaveBeenCalledTimes(1);
		expect(convexAction).toHaveBeenCalledWith(api.commentActions.softDeleteComment, {
			commentId: 'comment123',
			password: undefined,
			ipHash: expect.any(String),
			adminSecret: ADMIN_SECRET
		});
		expect(convexMutation).not.toHaveBeenCalled();
	});

	it('soft-deletes when x-admin-secret header is present (does not hard-delete)', async () => {
		const res = await DELETE({
			params: { id: 'comment123' },
			request: new Request('http://localhost/api/comments/comment123', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'x-admin-secret': ADMIN_SECRET
				},
				body: JSON.stringify({ password: 'ignored' })
			})
		});

		expect(res.status).toBe(200);
		expect(convexAction).toHaveBeenCalledTimes(1);
		expect(convexMutation).not.toHaveBeenCalled();
	});
});

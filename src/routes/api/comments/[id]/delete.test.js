import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminSessionToken } from '$lib/server/admin';
import { api } from '$convex/_generated/api';

const mockAction = vi.fn();
const mockMutation = vi.fn();

vi.mock('$lib/server/convex', () => ({
	convex: {
		action: (...args) => mockAction(...args),
		mutation: (...args) => mockMutation(...args)
	}
}));

const { DELETE } = await import('./+server.ts');

function deleteRequest({ password = 'secret', cookie = '' } = {}) {
	return new Request('http://localhost/api/comments/comment123', {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json',
			...(cookie ? { cookie } : {})
		},
		body: JSON.stringify({ password })
	});
}

describe('DELETE /api/comments/[id]', () => {
	beforeEach(() => {
		mockAction.mockReset().mockResolvedValue({ success: true });
		mockMutation.mockReset().mockResolvedValue(undefined);
	});

	it('soft-deletes for anonymous visitors with a password', async () => {
		const res = await DELETE({
			params: { id: 'comment123' },
			request: deleteRequest({ password: 'mypass' })
		});

		expect(res.status).toBe(200);
		expect(mockAction).toHaveBeenCalledWith(api.commentActions.softDeleteComment, {
			commentId: 'comment123',
			password: 'mypass',
			ipHash: expect.any(String),
			adminSecret: undefined
		});
		expect(mockMutation).not.toHaveBeenCalled();
	});

	it('soft-deletes when an admin session cookie is present (never hard-deletes)', async () => {
		const token = createAdminSessionToken();
		const res = await DELETE({
			params: { id: 'comment123' },
			request: deleteRequest({ cookie: `admin_token=${token}` })
		});

		expect(res.status).toBe(200);
		expect(mockAction).toHaveBeenCalledWith(api.commentActions.softDeleteComment, {
			commentId: 'comment123',
			password: '',
			ipHash: expect.any(String),
			adminSecret: 'test-admin-secret-value'
		});
		expect(mockMutation).not.toHaveBeenCalled();
	});
});

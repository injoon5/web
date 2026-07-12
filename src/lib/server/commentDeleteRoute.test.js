import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminSessionToken } from '$lib/server/admin';
import { ADMIN_SECRET } from '$env/static/private';

const softDeleteComment = vi.fn().mockResolvedValue({ success: true });
const hardDelete = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/server/convex', () => ({
	convex: {
		action: (...args) => softDeleteComment(...args),
		mutation: (...args) => hardDelete(...args)
	}
}));

import { DELETE } from '../../routes/api/comments/[id]/+server.ts';

function deleteRequest({ password, admin = false } = {}) {
	const headers = { 'Content-Type': 'application/json' };
	if (admin) {
		headers.cookie = `admin_token=${encodeURIComponent(createAdminSessionToken())}`;
	}
	return new Request('http://x/api/comments/c1', {
		method: 'DELETE',
		headers,
		body: JSON.stringify({ password: password ?? 'pw1234' })
	});
}

describe('DELETE /api/comments/[id]', () => {
	beforeEach(() => {
		softDeleteComment.mockClear();
		hardDelete.mockClear();
	});

	it('soft-deletes for visitors with a password', async () => {
		const res = await DELETE({
			params: { id: 'c1' },
			request: deleteRequest({ password: 'pw1234' })
		});

		expect(res.status).toBe(200);
		expect(softDeleteComment).toHaveBeenCalledOnce();
		expect(hardDelete).not.toHaveBeenCalled();
	});

	it('soft-deletes for admins instead of hard-deleting the thread', async () => {
		const res = await DELETE({
			params: { id: 'c1' },
			request: deleteRequest({ admin: true, password: 'pw1234' })
		});

		expect(res.status).toBe(200);
		expect(softDeleteComment).toHaveBeenCalledOnce();
		expect(hardDelete).not.toHaveBeenCalled();
		expect(softDeleteComment.mock.calls[0][1]).toMatchObject({
			commentId: 'c1',
			adminSecret: ADMIN_SECRET
		});
	});
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminSessionToken } from './admin';

vi.mock('$lib/server/convex', () => ({
	convex: {
		action: vi.fn(),
		mutation: vi.fn()
	}
}));

import { convex } from '$lib/server/convex';
import { DELETE } from '../../routes/api/comments/[id]/+server.ts';

beforeEach(() => {
	vi.clearAllMocks();
	convex.action.mockResolvedValue({ success: true });
	convex.mutation.mockResolvedValue(undefined);
});

function deleteRequest({ password = 'pw12', cookie } = {}) {
	const headers = { 'Content-Type': 'application/json' };
	if (cookie) headers.cookie = cookie;
	return new Request('http://x/api/comments/c1', {
		method: 'DELETE',
		headers,
		body: JSON.stringify({ password })
	});
}

describe('DELETE /api/comments/[id] (public route)', () => {
	it('soft-deletes with password for a normal visitor', async () => {
		await DELETE({ params: { id: 'c1' }, request: deleteRequest() });

		expect(convex.action).toHaveBeenCalledTimes(1);
		expect(convex.mutation).not.toHaveBeenCalled();
	});

	it('still soft-deletes when an admin_token cookie is present', async () => {
		const token = createAdminSessionToken();
		await DELETE({
			params: { id: 'c1' },
			request: deleteRequest({ cookie: `admin_token=${token}` })
		});

		expect(convex.action).toHaveBeenCalledTimes(1);
		expect(convex.mutation).not.toHaveBeenCalled();
	});

	it('still soft-deletes when x-admin-secret header is present', async () => {
		const { ADMIN_SECRET } = await import('$env/static/private');
		const req = new Request('http://x/api/comments/c1', {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				'x-admin-secret': ADMIN_SECRET
			},
			body: JSON.stringify({ password: 'pw12' })
		});

		await DELETE({ params: { id: 'c1' }, request: req });

		expect(convex.action).toHaveBeenCalledTimes(1);
		expect(convex.mutation).not.toHaveBeenCalled();
	});
});

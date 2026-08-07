import { describe, it, expect, beforeEach, vi } from 'vitest';

// The route imports the real Convex HTTP client, which needs PUBLIC_CONVEX_URL
// and a live deployment; swap it for spies so we can assert which Convex
// function the handler picked.
vi.mock('$lib/server/convex.js', () => ({
	convex: {
		action: vi.fn().mockResolvedValue(undefined),
		mutation: vi.fn().mockResolvedValue(undefined)
	}
}));

import { getFunctionName } from 'convex/server';
import { convex } from '$lib/server/convex.js';
import { createAdminSessionToken } from '$lib/server/admin.js';
import { ADMIN_SECRET } from '$env/static/private';
import { DELETE } from './+server.js';

function deleteRequest(headers = {}) {
	return new Request('http://x/api/comments/c1', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: JSON.stringify({ password: 'pw12' })
	});
}

function callDelete(headers) {
	return DELETE({ params: { id: 'c1' }, request: deleteRequest(headers) });
}

/** Name of the Convex function reference passed to convex.action(). */
function calledAction() {
	return getFunctionName(convex.action.mock.calls[0][0]);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('DELETE /api/comments/[id]', () => {
	it('soft-deletes for an anonymous visitor', async () => {
		const res = await callDelete();

		expect(res.status).toBe(200);
		expect(calledAction()).toContain('softDeleteComment');
		expect(convex.action).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ commentId: 'c1', password: 'pw12' })
		);
		expect(convex.mutation).not.toHaveBeenCalled();
	});

	// Regression: the site owner browsing their own post carries an admin_token
	// cookie. The route used to read that as "hard delete", so an ordinary
	// visitor-side delete wiped the comment and its whole reply subtree.
	it('still only soft-deletes when the request carries an admin session cookie', async () => {
		const res = await callDelete({ cookie: `admin_token=${createAdminSessionToken()}` });

		expect(res.status).toBe(200);
		expect(calledAction()).toContain('softDeleteComment');
		expect(convex.mutation).not.toHaveBeenCalled();
	});

	it('still only soft-deletes when the request carries the admin secret header', async () => {
		const res = await callDelete({ 'x-admin-secret': ADMIN_SECRET });

		expect(res.status).toBe(200);
		expect(calledAction()).toContain('softDeleteComment');
		expect(convex.mutation).not.toHaveBeenCalled();
	});

	it('requires a password even from an admin session', async () => {
		const request = new Request('http://x/api/comments/c1', {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				cookie: `admin_token=${createAdminSessionToken()}`
			},
			body: JSON.stringify({})
		});

		await expect(DELETE({ params: { id: 'c1' }, request })).rejects.toMatchObject({ status: 400 });

		expect(convex.action).not.toHaveBeenCalled();
		expect(convex.mutation).not.toHaveBeenCalled();
	});
});

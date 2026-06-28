import { describe, it, expect, vi, beforeEach } from 'vitest';

const softDeleteComment = vi.fn();
const hardDelete = vi.fn();
const verifyAdminSecret = vi.fn();

vi.mock('$lib/server/convex', () => ({
	convex: {
		action: (...args) => softDeleteComment(...args),
		mutation: (...args) => hardDelete(...args)
	}
}));

vi.mock('$convex/_generated/api', () => ({
	api: {
		commentActions: { softDeleteComment: 'commentActions.softDeleteComment' },
		comments: { hardDelete: 'comments.hardDelete' }
	}
}));

vi.mock('$lib/server/admin', () => ({
	verifyAdminSecret: (...args) => verifyAdminSecret(...args)
}));

vi.mock('$lib/server/ip', () => ({
	requestIpHash: () => 'hashed-ip'
}));

vi.mock('$lib/server/api', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		parseBody: vi.fn(async () => ({ password: 'secret' })),
		runConvex: vi.fn(async (fn, onSuccess) => {
			const result = await fn();
			return onSuccess ? onSuccess(result) : result;
		})
	};
});

import { DELETE } from '../../routes/api/comments/[id]/+server.ts';

function deleteRequest() {
	return new Request('http://localhost/api/comments/k123', {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json',
			cookie: 'admin_token=valid-session-token'
		},
		body: JSON.stringify({ password: 'secret' })
	});
}

describe('DELETE /api/comments/[id]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('always soft-deletes, even when the admin session cookie is present', async () => {
		verifyAdminSecret.mockReturnValue(true);

		const res = await DELETE({
			params: { id: 'k123' },
			request: deleteRequest()
		});

		expect(res.status).toBe(200);
		expect(softDeleteComment).toHaveBeenCalledWith('commentActions.softDeleteComment', {
			commentId: 'k123',
			password: 'secret',
			ipHash: 'hashed-ip'
		});
		expect(hardDelete).not.toHaveBeenCalled();
	});

	it('soft-deletes for non-admin callers', async () => {
		verifyAdminSecret.mockReturnValue(false);

		await DELETE({
			params: { id: 'k456' },
			request: deleteRequest()
		});

		expect(softDeleteComment).toHaveBeenCalledWith('commentActions.softDeleteComment', {
			commentId: 'k456',
			password: 'secret',
			ipHash: 'hashed-ip'
		});
		expect(hardDelete).not.toHaveBeenCalled();
	});
});

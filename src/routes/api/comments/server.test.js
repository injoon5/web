import { describe, it, expect, beforeEach, vi } from 'vitest';

// The route imports the real Convex HTTP client, which needs PUBLIC_CONVEX_URL
// and a live deployment; swap it for spies so we can assert call order.
vi.mock('$lib/server/convex.js', () => ({
	convex: {
		query: vi.fn().mockResolvedValue([]),
		mutation: vi.fn().mockResolvedValue({ _id: 'c1' })
	}
}));

// Every URL is a real page here; `valid-urls` builds its set from the content
// globs, which is not what these cases are about.
vi.mock('$lib/server/valid-urls.js', () => ({ isValidPageUrl: () => true }));

vi.mock('bcryptjs', () => ({
	default: { hash: vi.fn().mockResolvedValue('$2a$10$hashed') }
}));

import { ConvexError } from 'convex/values';
import { getFunctionName } from 'convex/server';
import bcrypt from 'bcryptjs';
import { convex } from '$lib/server/convex.js';
import { POST } from './+server.js';

function postRequest(body = {}) {
	return new Request('http://x/api/comments', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			url: '/blog/test',
			username: 'someone',
			password: 'pw12',
			text: 'hello',
			...body
		})
	});
}

/** Names of the Convex functions passed to convex.mutation(), in call order. */
function calledMutations() {
	return convex.mutation.mock.calls.map(([ref]) => getFunctionName(ref));
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('POST /api/comments', () => {
	it('gates on the IP before hashing, then creates', async () => {
		const res = await POST({ request: postRequest() });

		expect(res.status).toBe(201);
		expect(calledMutations()).toEqual([
			expect.stringContaining('checkCanCreate'),
			expect.stringContaining('create')
		]);

		// Ordering is the whole point: the hash must not be computed until the
		// gate has cleared the caller.
		const gateOrder = convex.mutation.mock.invocationCallOrder[0];
		const hashOrder = bcrypt.hash.mock.invocationCallOrder[0];
		expect(gateOrder).toBeLessThan(hashOrder);
	});

	it.each([
		['Banned', 403],
		['RateLimited', 429]
	])('rejects a %s caller without ever hashing', async (kind, status) => {
		convex.mutation.mockRejectedValueOnce(new ConvexError({ kind, retryAfter: 2000 }));

		const res = await POST({ request: postRequest() }).catch((thrown) => thrown);

		expect(res.status).toBe(status);
		expect(bcrypt.hash).not.toHaveBeenCalled();
		// The gate was the only Convex call — nothing was written.
		expect(calledMutations()).toEqual([expect.stringContaining('checkCanCreate')]);
	});
});

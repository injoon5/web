import { describe, it, expect, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { parseBody, convexErrorToResponse, runConvex } from './api.js';

function jsonRequest(body) {
	return new Request('http://x/api', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

describe('convexErrorToResponse', () => {
	it('maps a RateLimited ConvexError to a 429 with Retry-After', () => {
		const res = convexErrorToResponse(new ConvexError({ kind: 'RateLimited', retryAfter: 2500 }));
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toBe('3');
	});

	it('defaults Retry-After to 1 second when none is provided', () => {
		const res = convexErrorToResponse(new ConvexError({ kind: 'RateLimited' }));
		expect(res.headers.get('Retry-After')).toBe('1');
	});

	it.each([
		['Banned', 403],
		['Unauthorized', 401],
		['NotFound', 404],
		['BadRequest', 400]
	])('maps a %s ConvexError to HTTP %i', (kind, status) => {
		expect(convexErrorToResponse(new ConvexError({ kind })).status).toBe(status);
	});

	it("answers with Convex's own message, which apiFetch shows", async () => {
		const res = convexErrorToResponse(new ConvexError({ kind: 'NotFound', message: 'gone' }));
		await expect(res.json()).resolves.toEqual({ message: 'gone' });
	});

	it('is a 500 for an unknown kind or a plain error', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(convexErrorToResponse(new ConvexError({ kind: 'Mystery' })).status).toBe(500);
		expect(convexErrorToResponse(new Error('boom')).status).toBe(500);
	});
});

describe('parseBody', () => {
	const schema = z.object({ name: z.string().min(1) });

	it('returns parsed data for a valid body', async () => {
		await expect(parseBody(jsonRequest({ name: 'ok' }), schema)).resolves.toEqual({ name: 'ok' });
	});

	it('throws 400 on invalid JSON', async () => {
		const err = await parseBody(jsonRequest('not json'), schema).catch((e) => e);
		expect(err.status).toBe(400);
	});

	it('throws 400 with the first validation message on schema mismatch', async () => {
		const err = await parseBody(jsonRequest({ name: '' }), schema).catch((e) => e);
		expect(err.status).toBe(400);
	});
});

describe('runConvex', () => {
	it('builds a JSON response on success', async () => {
		const res = await runConvex(async () => ({ ok: true }));
		expect(res).toBeInstanceOf(Response);
		await expect(res.json()).resolves.toEqual({ ok: true });
	});

	it('uses a custom build function', async () => {
		const res = await runConvex(
			async () => ({ comment: 'c' }),
			(data) => new Response(JSON.stringify({ wrapped: data }), { status: 201 })
		);
		expect(res.status).toBe(201);
	});

	it('returns a 429 Response when the call is rate limited', async () => {
		const res = await runConvex(async () => {
			throw new ConvexError({ kind: 'RateLimited', retryAfter: 1000 });
		});
		expect(res.status).toBe(429);
	});

	it('answers a non-rate-limit Convex error with its status', async () => {
		const res = await runConvex(async () => {
			throw new ConvexError({ kind: 'NotFound' });
		});
		expect(res.status).toBe(404);
	});
});

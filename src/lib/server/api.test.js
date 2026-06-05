import { describe, it, expect } from 'vitest';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { parseBody, convexErrorToResponse, runConvex, handleConvexErr } from './api';

/** Run `fn`, returning the thrown error (or undefined if it didn't throw). */
function caught(fn) {
	try {
		fn();
	} catch (err) {
		return err;
	}
	return undefined;
}

function jsonRequest(body) {
	return new Request('http://x/api', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

describe('convexErrorToResponse', () => {
	it('maps a RateLimited ConvexError to a 429 Response with Retry-After', () => {
		const res = convexErrorToResponse(new ConvexError({ kind: 'RateLimited', retryAfter: 2500 }));
		expect(res).toBeInstanceOf(Response);
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
		['Forbidden', 403],
		['NotFound', 404],
		['BadRequest', 400],
		['Unknown', 500]
	])('maps a %s ConvexError to HTTP %i', (kind, status) => {
		const err = caught(() => convexErrorToResponse(new ConvexError({ kind })));
		expect(err?.status).toBe(status);
	});

	it('handles the cross-boundary { data: { kind } } shape', () => {
		const err = caught(() =>
			convexErrorToResponse({ data: { kind: 'NotFound', message: 'gone' } })
		);
		expect(err?.status).toBe(404);

		const res = convexErrorToResponse({ data: { kind: 'RateLimited' } });
		expect(res).toBeInstanceOf(Response);
		expect(res.status).toBe(429);
	});

	it('maps a plain Error mentioning Unauthorized to 401, else 500', () => {
		expect(
			caught(() => convexErrorToResponse(new Error('Server Error: Unauthorized')))?.status
		).toBe(401);
		expect(caught(() => convexErrorToResponse(new Error('boom')))?.status).toBe(500);
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

	it('throws a mapped HttpError for non-rate-limit Convex errors', async () => {
		const err = await runConvex(async () => {
			throw new ConvexError({ kind: 'NotFound' });
		}).catch((e) => e);
		expect(err.status).toBe(404);
	});
});

describe('handleConvexErr', () => {
	it('returns a Response for rate limits and throws otherwise', () => {
		expect(handleConvexErr(new ConvexError({ kind: 'RateLimited' }))).toBeInstanceOf(Response);
		expect(caught(() => handleConvexErr(new ConvexError({ kind: 'Banned' })))?.status).toBe(403);
	});
});

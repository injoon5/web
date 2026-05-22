import { error, json } from '@sveltejs/kit';
import { ConvexError } from 'convex/values';

/**
 * Convert a thrown Convex error into a SvelteKit Response.
 * Handles structured ConvexError payloads (`{ kind, message?, retryAfter? }`)
 * and falls back to a generic 500 for anything else.
 */
export function convexErrorToResponse(err) {
	if (err instanceof ConvexError) {
		const data = err.data ?? {};
		const kind = data.kind ?? 'Unknown';
		const message = data.message ?? defaultMessage(kind);

		if (kind === 'RateLimited') {
			const retryAfter = Math.max(1, Math.ceil((data.retryAfter ?? 1000) / 1000));
			return new Response(JSON.stringify({ message }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': String(retryAfter)
				}
			});
		}

		const status = statusForKind(kind);
		throw error(status, message);
	}

	// Convex sometimes surfaces ConvexError via { name: 'ConvexError', data: ... }
	// across the HTTP boundary; check for that too.
	if (err && typeof err === 'object' && 'data' in err && err.data && typeof err.data === 'object') {
		const data = err.data;
		if (data.kind === 'RateLimited') {
			const retryAfter = Math.max(1, Math.ceil((data.retryAfter ?? 1000) / 1000));
			return new Response(JSON.stringify({ message: defaultMessage('RateLimited') }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': String(retryAfter)
				}
			});
		}
		if (typeof data.kind === 'string') {
			throw error(statusForKind(data.kind), data.message ?? defaultMessage(data.kind));
		}
	}

	const message = err instanceof Error ? err.message : String(err);
	// Convex serializes thrown plain Error objects as `Server Error: <msg>`.
	if (message.includes('Unauthorized')) throw error(401, 'Unauthorized');

	throw error(500, 'Internal error');
}

function statusForKind(kind) {
	switch (kind) {
		case 'Banned':
			return 403;
		case 'Unauthorized':
			return 401;
		case 'Forbidden':
			return 403;
		case 'NotFound':
			return 404;
		case 'BadRequest':
			return 400;
		case 'RateLimited':
			return 429;
		default:
			return 500;
	}
}

function defaultMessage(kind) {
	switch (kind) {
		case 'Banned':
			return 'You have been banned';
		case 'Unauthorized':
			return 'Unauthorized';
		case 'Forbidden':
			return 'Forbidden';
		case 'NotFound':
			return 'Not found';
		case 'BadRequest':
			return 'Bad request';
		case 'RateLimited':
			return 'Too many requests. Please slow down.';
		default:
			return 'Internal error';
	}
}

/**
 * Wraps a Convex call, returning either the resolved JSON response or
 * throwing/returning the mapped error response.
 */
export async function runConvex(fn, build = (data) => json(data)) {
	try {
		const result = await fn();
		return build(result);
	} catch (err) {
		const mapped = convexErrorToResponse(err);
		if (mapped instanceof Response) return mapped;
		throw mapped;
	}
}

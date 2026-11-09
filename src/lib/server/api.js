// @ts-check
import { error } from '@sveltejs/kit';
import { ERROR_KINDS } from '#convex/lib/errors.js';

/**
 * Parse the request body as JSON and validate it against a Zod schema.
 * Throws a 400 on parse or validation failure.
 *
 * @template T
 * @param {Request} request
 * @param {import('zod').ZodType<T>} schema
 * @returns {Promise<T>}
 */
export async function parseBody(request, schema) {
	let raw;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid request');
	}
	return parsed.data;
}

/**
 * The JSON response for an error thrown by a Convex call: a `ConvexError` whose
 * `kind` is one of `ERROR_KINDS` answers with that status, anything else is a
 * 500. The body is `{ message }`, the shape `apiFetch` reads.
 *
 * @param {unknown} err
 * @returns {Response}
 */
export function convexErrorToResponse(err) {
	/** @type {{ kind?: string, message?: string, retryAfter?: number }} */
	const data = /** @type {any} */ (err)?.data ?? {};
	const known = data.kind ? ERROR_KINDS[/** @type {keyof ERROR_KINDS} */ (data.kind)] : null;
	if (!known) {
		console.error(err);
		return Response.json({ message: 'Internal error' }, { status: 500 });
	}

	const headers = new Headers();
	if (data.kind === 'RateLimited') {
		headers.set('Retry-After', String(Math.max(1, Math.ceil((data.retryAfter ?? 1000) / 1000))));
	}
	return Response.json(
		{ message: data.message ?? known.message },
		{ status: known.status, headers }
	);
}

/**
 * Run a Convex call and answer with `build(result)`, or with the error's
 * response if it throws.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {(result: T) => Response} [build]
 * @returns {Promise<Response>}
 */
export async function runConvex(fn, build = (data) => Response.json(data)) {
	let result;
	try {
		result = await fn();
	} catch (err) {
		return convexErrorToResponse(err);
	}
	return build(result);
}

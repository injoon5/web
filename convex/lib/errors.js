import { ConvexError } from 'convex/values';

/**
 * Every `kind` a Convex function may throw, with the HTTP status and default
 * message the SvelteKit routes answer it with (`src/lib/server/api.js`).
 * `RateLimited` is also what `@convex-dev/rate-limiter` throws on its own.
 */
export const ERROR_KINDS = {
	BadRequest: { status: 400, message: 'Bad request' },
	Unauthorized: { status: 401, message: 'Unauthorized' },
	Banned: { status: 403, message: 'You have been banned' },
	NotFound: { status: 404, message: 'Not found' },
	RateLimited: { status: 429, message: 'Too many requests. Please slow down.' }
};

/**
 * @param {keyof typeof ERROR_KINDS} kind
 * @param {string} [message]
 * @returns {never}
 */
export function fail(kind, message) {
	throw new ConvexError(message === undefined ? { kind } : { kind, message });
}

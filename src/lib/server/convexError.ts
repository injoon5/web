/**
 * Handles ConvexError thrown by mutations.
 * Returns a 429 Response when rate-limited, or re-throws for other errors.
 */
export function handleConvexError(err: unknown, rateLimitMessage: string): Response {
	const data = (err as { data?: { code?: string; retryAfter?: number; message?: string } }).data;

	if (data?.code === 'RATE_LIMITED') {
		const sec = Math.ceil((data.retryAfter ?? 0) / 1000);
		return new Response(JSON.stringify({ error: rateLimitMessage }), {
			status: 429,
			headers: { 'Content-Type': 'application/json', 'Retry-After': String(sec) }
		});
	}

	if (data?.code === 'BANNED') {
		return new Response(JSON.stringify({ error: data.message ?? 'You have been banned' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	throw err;
}

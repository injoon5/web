import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { DEFAULT_RANGE } from '$lib/health/metrics.js';
import { dateKey, shiftDateKey } from '$convex/lib/health.js';

export const prerender = false;

/**
 * The page renders the same window its live subscription then watches, through
 * the same query — so the render and every visitor's subscription land on one
 * Convex cache entry rather than an action plus four separate ones.
 *
 * The window comes from the server's clock and is echoed back, so the range
 * picker pivots on what was rendered rather than the visitor's idea of today.
 */

/**
 * The last day the window covers. A day key is written in the phone's local
 * calendar, which can be a day ahead of UTC, so the window reaches one day past
 * UTC-today; that slot is simply empty for anyone at or behind UTC.
 */
function windowEndDate(now = Date.now()) {
	return dateKey(now + 86400000);
}

/**
 * Not `async`, and `report` is deliberately left as a promise: awaiting Convex
 * held the whole document until four series came back. SvelteKit streams it, so
 * the shell flushes immediately and the charts arrive in a later chunk.
 *
 * `endDate` resolves from the clock rather than the query, so it ships in the
 * first chunk — which is what lets the client subscribe at hydration.
 */
export function load({ setHeaders }) {
	const endDate = windowEndDate();
	const startDate = shiftDateKey(endDate, -(DEFAULT_RANGE - 1));

	// One window for everyone now the range is client state, so this is a single
	// shared cache entry. The page is realtime after hydration, so a minute-old
	// first paint corrects itself.
	setHeaders({ 'cache-control': 'public, max-age=60, stale-while-revalidate=300' });

	return {
		endDate,
		// A rejection here is a page with no charts, not a 500: the live
		// subscription is about to try the same query again from the browser.
		report: convex
			.query(api.healthPublic.page, { startDate, days: DEFAULT_RANGE })
			.catch(() => null)
	};
}

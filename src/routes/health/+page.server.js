import { convex } from '$lib/server/convex.js';
import { api } from '$convex/_generated/api';
import { DEFAULT_RANGE } from '$lib/health/metrics.js';
import { dateKey, shiftDateKey } from '$convex/lib/health.js';

export const prerender = false;

/**
 * The page renders the same window its live subscription then watches, through
 * the same query.
 *
 * It used to go through the key-gated `/health/series` HTTP action, because
 * every health read was internal. `convex/healthPublic.js` is the deliberate
 * exception — it serves exactly what this page publishes and nothing else — and
 * once the page had it, routing the server render through the action was pure
 * cost: an action cold start, a bearer-key comparison, and four sub-queries
 * cached under arguments no browser would ever ask for. Calling the public query
 * directly puts the render and every visitor's subscription on one Convex cache
 * entry, so the first paint is usually served from a result already in memory.
 *
 * The window still comes from the server's clock and is echoed back to the page,
 * so the range picker pivots on what was rendered rather than on the visitor's
 * own idea of today.
 */

/**
 * The last day the window covers.
 *
 * A day key is written in the phone's local calendar, which can be a day ahead
 * of UTC, so the window reaches one day past UTC-today. The extra slot is empty
 * for anyone at or behind UTC — which is exactly what a day with no data looks
 * like.
 */
function windowEndDate(now = Date.now()) {
	return dateKey(now + 86400000);
}

/**
 * Not `async`, and `report` is deliberately left as a promise.
 *
 * Awaiting Convex here held the whole document: nothing — not the `<head>`, not
 * the title, not the stylesheet link — reached the browser until four series
 * came back. Returning the promise streams it instead, so the shell and the
 * header flush immediately and the charts arrive in a later chunk.
 *
 * `endDate` is resolved from the clock rather than from the query, so it ships
 * in the first chunk. That is what lets the client open its Convex subscription
 * at hydration instead of waiting for the streamed half to land.
 */
export function load({ setHeaders }) {
	const endDate = windowEndDate();
	const startDate = shiftDateKey(endDate, -(DEFAULT_RANGE - 1));

	// One window for everyone now that the range is client-side, so this is a
	// single shared cache entry rather than one per query string. The stale
	// window keeps a burst of traffic off Convex while the next render lands —
	// the page is realtime after hydration anyway, so a minute-old first paint
	// corrects itself on the client.
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

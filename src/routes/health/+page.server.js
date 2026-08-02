import { env } from '$env/dynamic/private';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { DEFAULT_RANGE, PAGE_METRICS } from '$lib/health/metrics.js';
import { latestSeriesUpdate, shiftDateKey } from '$convex/lib/health.js';

// The health queries are internal, so there is no ConvexHttpClient path to them —
// the key-checking HTTP action is the only entry point, and the key never leaves
// the server.
export const prerender = false;

/** Every line on the page in one call. Constant, so it is built once per process. */
const METRIC_PARAM = PAGE_METRICS.map((m) => m.key).join(',');

/**
 * The range is picked in the browser, not through the URL.
 *
 * A `?days=` param was a lever anyone could pull: each distinct value is a
 * distinct Convex cache entry and a distinct SSR render, so a crawler walking
 * made-up values would miss every cache on the way through. The server now
 * renders one window, and the range picker moves the live subscription instead.
 */
function siteUrl() {
	if (env.CONVEX_SITE_URL) return env.CONVEX_SITE_URL.replace(/\/$/, '');
	return PUBLIC_CONVEX_URL.replace(/\.convex\.cloud\/?$/, '.convex.site');
}

export async function load({ fetch, setHeaders }) {
	const empty = { endDate: null, series: [], updatedAt: null, available: false };

	if (!env.HEALTH_API_KEY) return empty;

	const res = await fetch(
		`${siteUrl()}/health/series?metrics=${METRIC_PARAM}&days=${DEFAULT_RANGE}`,
		{ headers: { Authorization: `Bearer ${env.HEALTH_API_KEY}` } }
	).catch(() => null);

	if (!res?.ok) return empty;

	const { series, startDate } = await res.json();

	// The page hands the window back to its Convex subscription rather than
	// re-deriving "today" against the visitor's clock. `endDate` rather than
	// `startDate` because that is the end the range picker pivots on: a shorter
	// range reaches back less far, it does not end somewhere else.
	const endDate = shiftDateKey(startDate, DEFAULT_RANGE - 1);

	// One window for everyone now that the range is client-side, so this is a
	// single shared cache entry rather than one per query string.
	setHeaders({ 'cache-control': 'public, max-age=60' });

	return { endDate, series, updatedAt: latestSeriesUpdate(series), available: true };
}

import { env } from '$env/dynamic/private';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { PAGE_METRICS, normalizeRange } from '$lib/health/metrics.js';

// The health queries are internal, so there is no ConvexHttpClient path to them —
// the key-checking HTTP action is the only entry point, and the key never leaves
// the server.
export const prerender = false;

const WORKOUT_LIMIT = 20;

/** Convex HTTP actions live on the `.site` twin of the deployment URL. */
function siteUrl() {
	if (env.CONVEX_SITE_URL) return env.CONVEX_SITE_URL.replace(/\/$/, '');
	return PUBLIC_CONVEX_URL.replace(/\.convex\.cloud\/?$/, '.convex.site');
}

export async function load({ fetch, url, setHeaders }) {
	const days = normalizeRange(url.searchParams.get('days'));
	const empty = { days, startDate: null, series: [], workouts: [], available: false };

	if (!env.HEALTH_API_KEY) return empty;

	const headers = { Authorization: `Bearer ${env.HEALTH_API_KEY}` };
	const base = siteUrl();
	const metrics = PAGE_METRICS.map((m) => m.key).join(',');

	// One series call covering every line on the page, plus the workout list.
	const [seriesRes, workoutRes] = await Promise.all([
		fetch(`${base}/health/series?metrics=${metrics}&days=${days}`, { headers }),
		fetch(`${base}/health/workouts?days=${days}&limit=${WORKOUT_LIMIT}`, { headers })
	]).catch(() => []);

	if (!seriesRes?.ok) return empty;

	// `startDate` is the window the server actually resolved. The page hands it
	// straight to its Convex subscription so the live data covers the same days
	// as the render instead of re-deriving "today" against the visitor's clock.
	const { series, startDate } = await seriesRes.json();
	const workouts = workoutRes?.ok ? (await workoutRes.json()).workouts : [];

	setHeaders({ 'cache-control': 'public, max-age=60' });

	return { days, startDate, series, workouts, available: true };
}

import { browser } from '$app/env';

/** @typedef {{ slug: string, title?: string, date?: string, series?: string }} SeriesEntry */
/** @typedef {Record<string, { enSeries: SeriesEntry[], koSeries: SeriesEntry[] }>} SeriesMap */

/** @type {Promise<SeriesMap> | null} */
let cached = null;

/**
 * `/api/series`, once per browser session. On the server it is fetched per
 * render (in-process) and never cached here: module state is shared between
 * requests.
 *
 * @param {typeof fetch} fetch  the load's `fetch`, so hydration reuses the
 *   server render's inlined response
 * @returns {Promise<SeriesMap>}
 */
export function seriesMap(fetch) {
	if (browser && cached) return cached;
	const request = fetch('/api/series')
		.then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
		.catch(() => {
			if (browser) cached = null;
			return {};
		});
	if (browser) cached = request;
	return request;
}

import { browser } from '$app/env';

/** @typedef {import('#lib/server/article-index.js').ArticleIndex} ArticleIndex */

/** @type {Promise<ArticleIndex> | null} */
let cached = null;

/**
 * `/api/articles.json`, once per browser session. On the server (prerendering)
 * it is fetched per render and never cached here: module state is shared
 * between requests.
 *
 * @param {typeof fetch} fetch  the load's `fetch`, so hydration reuses the
 *   response the prerender inlined
 * @returns {Promise<ArticleIndex>}
 */
export function articleIndex(fetch) {
	if (browser && cached) return cached;
	const request = fetch('/api/articles.json').then((res) => {
		if (!res.ok) throw new Error(`articles.json: ${res.status}`);
		return res.json();
	});
	if (browser) {
		cached = request;
		request.catch(() => (cached = null));
	}
	return request;
}

import { browser, building } from '$app/env';

/**
 * Per-visitor state for the article pages, read without a server load.
 *
 * A server load on `[slug]` meant every client-side navigation to a post sat on
 * a `__data.json` round trip to the serverless function — over a second when it
 * was cold — and only then requested the post's own chunks. Nothing it returned
 * needed to block the page:
 *
 * - The language preference is a cookie the page itself writes. The browser
 *   reads it straight off `document.cookie`; only the server render has to ask
 *   for it, through `/api/visitor`, which runs in-process there.
 * - `ipHash` only decides whether the heart is filled and which vote is yours.
 *   The browser fetches it once per session and the like count does not wait
 *   for it. During hydration that fetch is answered from the response the
 *   server render inlined, so a landing on a post costs no extra request.
 */
export const visitor = $state({ ipHash: '' });

/** @type {Promise<void> | null} */
let pending = null;

/**
 * Start (once per session) the browser's `/api/visitor` request. Never awaited
 * by a load: the page renders without it.
 *
 * @param {typeof fetch} fetch  the load's `fetch`, so hydration reuses the
 *   server render's inlined response
 */
function requestVisitor(fetch) {
	pending ??= fetch('/api/visitor')
		.then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
		.then((v) => {
			visitor.ipHash = v.ipHash ?? '';
		})
		.catch(() => {
			// Try again on the next article navigation.
			pending = null;
		});
}

/** @param {string} cookie */
function cookieLang(cookie) {
	const match = cookie.match(/(?:^|;\s*)preferred-lang=([^;]*)/);
	return match ? decodeURIComponent(match[1]) : null;
}

/**
 * The visitor's preferred language for a bilingual page: `?lang=`, then the
 * `preferred-lang` cookie. Also starts the browser's `ipHash` request.
 *
 * @param {URL} url
 * @param {typeof fetch} fetch  the load's `fetch`
 * @returns {Promise<string | null>}
 */
export async function preferredLang(url, fetch) {
	// searchParams and cookies are unavailable while the prerender crawler
	// visits SSR-only routes linked from prerendered pages.
	if (building) return null;

	const fromQuery = url.searchParams.get('lang');
	if (browser) {
		requestVisitor(fetch);
		return fromQuery || cookieLang(document.cookie);
	}
	// The server render is the one place the cookie is out of reach of a
	// universal load. The request runs in-process, and its response is inlined
	// for hydration — which is what answers `requestVisitor` above for free, so
	// it is made even when `?lang=` already decides.
	const res = await fetch('/api/visitor');
	const fromCookie = res.ok ? ((await res.json()).lang ?? null) : null;
	return fromQuery || fromCookie;
}

import { browser } from '$app/env';

/**
 * Per-visitor state for the article pages, which are prerendered and so know
 * nothing about who is reading.
 *
 * - `ipHash` only decides whether the heart is filled and which vote is yours.
 *   The browser fetches it once per session from `/api/visitor`, and nothing
 *   waits for it: the post renders, the like count shows, and the heart and
 *   votes fill in when it lands.
 * - The language is the URL (`#lib/content/article-paths.js`). The
 *   `preferred-lang` cookie only remembers what the visitor picked, so that
 *   vercel.json can send a direct visit to `/en`, and a link followed inside the
 *   site can do the same in the browser.
 */
export const visitor = $state({ ipHash: '' });

/** @type {Promise<void> | null} */
let pending = null;

/**
 * Take the hash a write was actually made under. The session's cached hash
 * goes stale when the visitor's address changes (Wi-Fi to cellular), and then
 * the subscription reads under one identity while `/api/likes` writes under
 * another: the heart never sees its own like come back and stays pending.
 *
 * @param {unknown} ipHash  `ipHash` from a write endpoint's response
 */
export function adoptIpHash(ipHash) {
	if (typeof ipHash === 'string' && ipHash && ipHash !== visitor.ipHash) visitor.ipHash = ipHash;
}

/**
 * Start (once per session) the browser's `/api/visitor` request. Never awaited:
 * the page renders without it.
 *
 * @param {typeof fetch} [fetch]
 */
export function loadVisitor(fetch = globalThis.fetch) {
	if (!browser) return;
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

const COOKIE = 'preferred-lang';

/** The language the visitor last picked, or null. Browser only. */
export function cookieLang() {
	if (!browser) return null;
	const match = document.cookie.match(/(?:^|;\s*)preferred-lang=([^;]*)/);
	return match ? decodeURIComponent(match[1]) : null;
}

/** @param {string} lang */
export function persistLang(lang) {
	try {
		document.cookie = `${COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
	} catch {
		// Cookies may be unavailable.
	}
}

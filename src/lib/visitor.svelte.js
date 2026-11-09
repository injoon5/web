import { browser } from '$app/env';

/**
 * This visitor's `ipHash`, for the article pages, which are prerendered and so
 * know nothing about who is reading. It only decides whether the heart is
 * filled and which vote is yours. The browser fetches it once per session from
 * `/api/visitor`, and nothing waits for it: the post renders, the like count
 * shows, and the heart and votes fill in when it lands.
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
			// A hash a write already adopted is newer than this one.
			visitor.ipHash ||= v.ipHash ?? '';
		})
		.catch(() => {
			// Try again on the next article navigation.
			pending = null;
		});
}

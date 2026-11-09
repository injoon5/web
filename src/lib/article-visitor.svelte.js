import { page } from '$app/state';
import { loadVisitor, visitor } from '#lib/visitor.svelte.js';

/**
 * What a per-visitor widget on an article (likes, comments) is keyed by: the
 * article — not one language of it, so `/blog/x/en` shares `/blog/x`'s — and
 * this visitor's `ipHash`, which it asks for itself (once per session, never
 * awaited) rather than relying on the article load to have done it.
 *
 * Call during component init.
 */
export function articleVisitor() {
	loadVisitor();
	return {
		get path() {
			return page.data.articlePath ?? page.url.pathname;
		},
		get ipHash() {
			return visitor.ipHash;
		}
	};
}

/**
 * Whether a `keepPreviousData` subscription's latest result belongs to the page
 * now showing. Such a subscription keeps the *previous page's* result across a
 * client-side navigation, so anything that renders it or acts on it has to wait
 * for this, or a visitor can act on the page they left.
 *
 * A result counts as fresh when `freshResult()` hands back a new non-null
 * value: each server push is a new object, while a retained result is the same
 * one.
 *
 * Call during component init.
 *
 * @param {() => string} path
 * @param {() => unknown} freshResult  the latest result, or null while it is stale or loading
 */
export function freshFor(path, freshResult) {
	let freshPath = $state(/** @type {string | null} */ (null));
	let last = /** @type {unknown} */ (null);
	$effect(() => {
		const result = freshResult();
		if (result && result !== last) {
			last = result;
			freshPath = path();
		}
	});
	return {
		get current() {
			return freshPath === path();
		}
	};
}

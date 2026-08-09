/**
 * What this page has already downloaded, keyed by URL.
 *
 * The lightbox cannot reuse the article's `<img>` element — it has to fly from
 * it and back to it, so that element has to stay where it is — which means the
 * same photo is on the page twice, as two elements, and the browser is the only
 * thing keeping that from being two downloads. Usually it is enough. On a slow
 * connection it visibly is not: an image the article had finished loading opened
 * into an empty lightbox, and one the lightbox had loaded closed back onto an
 * empty hole in the article.
 *
 * So the two halves are told about each other here:
 *
 * - Every `<img>` that finishes loading — in the article, in a gallery, in the
 *   lightbox — reports its URL and natural size. `isLoaded`/`sizeOf` then answer
 *   for a URL rather than for an element, so the lightbox knows the pixels exist
 *   before it has mounted anything, and can size and reveal its copy at once
 *   instead of starting from nothing.
 * - The element itself is retained. A live `HTMLImageElement` holding a decoded
 *   resource keeps it in the browser's memory cache, so the *next* element with
 *   that URL — the lightbox's copy, or the article's after a close — paints from
 *   memory instead of going back to the network.
 *
 * Bounded, because a photo essay is a hundred images and holding every decoded
 * bitmap for the session is not a cache, it is a leak. Least-recently-noted goes
 * first; the sizes are kept for all of them, since those are two numbers.
 */

/** Decoded images held to keep them in the browser's memory cache. */
const RETAIN_LIMIT = 24;

/** @type {Map<string, { width: number, height: number }>} */
const sizes = new Map();
/** @type {Map<string, HTMLImageElement>} Insertion-ordered, oldest first. */
const retained = new Map();

/** An `<img>` that has actually decoded, as opposed to one that merely exists. */
function isPainted(el) {
	return Boolean(el?.complete && el.naturalWidth > 0);
}

/**
 * Record what an `<img>` finished loading. Safe to call on every `load` event
 * and on elements that turn out not to have loaded at all.
 *
 * @param {HTMLImageElement | null | undefined} el
 */
export function noteImage(el) {
	if (!isPainted(el)) return;
	// `currentSrc` is the file the browser actually fetched, which is the one
	// another element with the same `src` will get from cache. On an image with
	// no `srcset` the two are the same string.
	const src = el.currentSrc || el.src;
	if (!src) return;
	sizes.set(src, { width: el.naturalWidth, height: el.naturalHeight });

	// Re-insert so a photo being looked at now outlives one from further up.
	retained.delete(src);
	retained.set(src, el);
	while (retained.size > RETAIN_LIMIT) {
		const oldest = retained.keys().next().value;
		if (oldest === undefined) break;
		retained.delete(oldest);
	}
}

/**
 * Has this exact URL already been downloaded and decoded on this page?
 * @param {string | null | undefined} src
 */
export function isLoaded(src) {
	return Boolean(src && sizes.has(src));
}

/**
 * The natural size of a URL this page has loaded, or null.
 * @param {string | null | undefined} src
 * @returns {{ width: number, height: number } | null}
 */
export function sizeOf(src) {
	return (src && sizes.get(src)) || null;
}

/**
 * Watch one `<img>`: report it to the cache when it lands, and hold the
 * placeholder in its box until then.
 *
 * `remarkImageSize` stamps `data-img-pending` at build time, so the placeholder
 * is in the first paint rather than appearing at hydration — which is well after
 * the browser started fetching. All this has to do is take it away again, and
 * take it away for an image that finished loading before hydration reached it.
 *
 * @param {HTMLImageElement} img
 */
export function trackImage(img) {
	// Server-rendered on markdown images. Anything else — a hand-written
	// component, an embed — gets them here.
	if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
	if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');

	if (isPainted(img)) {
		settle(img);
		return;
	}
	// No `width`/`height` means no box, and a placeholder with no box is a
	// 0x0 nothing that only makes the alt text disappear.
	if (img.getAttribute('width') && img.getAttribute('height')) {
		img.setAttribute('data-img-pending', 'true');
	}
	img.addEventListener('load', () => settle(img), { once: true });
	// A broken image keeps its alt text rather than a placeholder that never ends.
	img.addEventListener('error', () => img.removeAttribute('data-img-pending'), { once: true });
}

/** @param {HTMLImageElement} img */
function settle(img) {
	noteImage(img);
	img.removeAttribute('data-img-pending');
}

/** @param {ParentNode | null | undefined} root */
export function trackImages(root) {
	root?.querySelectorAll('img').forEach(trackImage);
}

/** Tests only — the maps are module state and outlive a component. */
export function resetImageCache() {
	sizes.clear();
	retained.clear();
}

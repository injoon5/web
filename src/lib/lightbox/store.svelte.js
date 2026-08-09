import { isLoaded, sizeOf, trackImages } from './image-cache.js';

/**
 * `null` = closed. Open is `{ items, index }`, where an item is
 * `{ src, alt, naturalWidth, naturalHeight }`. A bare item is also accepted —
 * `normalizeLightboxValue` widens it into a one-image group.
 */
let value = $state(null);

export const lightboxStore = {
	get value() {
		return value;
	},
	set(next) {
		value = next;
	}
};

/** Max displayed height for lightbox images (px). Keeps tall shots from filling the viewport. */
export const MAX_LIGHTBOX_HEIGHT = 900;

/**
 * Open the lightbox on a set of images.
 * @param {Array<{ src: string, alt?: string, naturalWidth?: number, naturalHeight?: number }>} items
 * @param {number} [index]
 */
export function openLightbox(items, index = 0) {
	if (!items?.length) return;
	lightboxStore.set({ items, index: Math.max(0, Math.min(index, items.length - 1)) });
}

/**
 * Accept either shape the store can hold and return the group form.
 * @returns {{ items: any[], index: number } | null}
 */
export function normalizeLightboxValue(value) {
	if (!value) return null;
	if (Array.isArray(value.items)) {
		return {
			items: value.items,
			index: Math.max(0, Math.min(value.index ?? 0, value.items.length - 1))
		};
	}
	return { items: [value], index: 0 };
}

/**
 * The source the lightbox should show, which is not always the one on screen.
 * `currentSrc` is whatever the browser picked for the *rendered* box, so on a
 * `srcset` image it is the thumbnail — opening it full-screen would upscale a
 * small file. `data-lightbox-src` wins outright, then the author's own `src`,
 * and `currentSrc` is the last resort.
 */
function fullSrc(img) {
	if (img.dataset?.lightboxSrc) return img.dataset.lightboxSrc;
	// `img.src` reflects the author's `src` attribute, resolved against the
	// document; `currentSrc` is only the fallback for an image that has nothing
	// but a `srcset`.
	return img.getAttribute('src') ? img.src : img.currentSrc || img.src;
}

/**
 * The size the build stamped on the element, which is there before a byte of the
 * image is. See `remarkImageSize`.
 */
function attrSize(img) {
	const width = Number(img.getAttribute?.('width'));
	const height = Number(img.getAttribute?.('height'));
	return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * How big the image *in the article* is: decoded, or loaded by something else on
 * the page, or measured by the build. Null when none of the three knows.
 *
 * @returns {{ width: number, height: number } | null}
 */
function elementSize(img) {
	if (img.naturalWidth > 0) return { width: img.naturalWidth, height: img.naturalHeight };
	return sizeOf(img.getAttribute?.('src') ? img.src : img.currentSrc) ?? attrSize(img);
}

/**
 * How big the file the lightbox will show is — which is the same file, unless
 * `data-lightbox-src` points at a larger one. Nothing the element knows
 * describes that larger file, so only the cache can answer for it.
 *
 * @returns {{ width: number, height: number } | null}
 */
function knownSize(img) {
	if (img.dataset?.lightboxSrc) return sizeOf(img.dataset.lightboxSrc);
	return elementSize(img);
}

function toItem(img) {
	const src = fullSrc(img);
	// Two different questions, and they are answered a moment apart: the shape is
	// known as soon as the header has arrived, the pixels only once the whole file
	// has. Sizing runs off the first, showing the photo off the second.
	const sized = img.naturalWidth > 0;
	const painted = Boolean(img.complete && sized);
	// The file the browser already has, which is the same one the lightbox is
	// about to show unless the author pointed it at a bigger one. The lightbox
	// paints it underneath its own copy, so an image the article has finished
	// loading opens as that image instead of as an empty box waiting on a second
	// download of the same bytes.
	const poster = painted ? img.currentSrc || img.src : null;
	const ownSrc = !img.dataset?.lightboxSrc;
	const size = knownSize(img);

	return {
		src,
		// A caption may be worth more than the alt text, and the two are not the
		// same job — `data-lightbox-caption` says the visible one out loud.
		alt: img.dataset?.lightboxCaption ?? img.alt,
		naturalWidth: size?.width ?? 0,
		naturalHeight: size?.height ?? 0,
		poster,
		// Only ever consulted when `naturalWidth` is unknown — a `data-lightbox-src`
		// file nothing has measured yet. The shape is right even when the size is
		// not, and a box of the right shape is what the placeholder needs.
		posterWidth: sized ? img.naturalWidth : 0,
		posterHeight: sized ? img.naturalHeight : 0,
		// The pixels for `src` exist on this page already, so the lightbox's copy
		// comes out of memory and can be shown at once rather than faded in from
		// nothing.
		ready: isLoaded(src) || (ownSrc && painted),
		// The element on the page this image is. The lightbox flies from it on
		// open and back to it on close, and hides it in between so the same photo
		// is never on screen twice. Optional: a caller that sets the store by hand
		// has no element, and the lightbox falls back to a plain fade.
		el: img
	};
}

/** Images an author has opted out of, plus the ones a group would swallow. */
function openable(img) {
	return !img.hasAttribute('data-no-lightbox');
}

/**
 * Every image in the article reports its load to the shared cache, and holds a
 * placeholder in its own box until then. See `image-cache.js`.
 */
export function lazyImagesAction(node) {
	trackImages(node);
}

export function lightboxAction(node) {
	lazyImagesAction(node);

	function handleClick(e) {
		// A modified click is the visitor asking the browser for something else
		// (open in a tab, save, extend a selection) — none of which is a lightbox.
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
			return;
		const img = e.target.closest('img');
		if (!img || !openable(img)) return;
		// Skip images inside links — the user may want to navigate
		if (img.closest('a')) return;

		// A gallery opens as a group, so the lightbox can page through it. The
		// grouping is declared in the markup (`data-lightbox-group`) rather than
		// guessed from sibling images, so an ordinary article of unrelated
		// screenshots doesn't turn into one long slideshow.
		const group = img.closest('[data-lightbox-group]');
		if (group) {
			const images = Array.from(group.querySelectorAll('img')).filter(openable);
			const index = images.indexOf(img);
			if (index === -1) return;
			e.preventDefault();
			openLightbox(images.map(toItem), index);
			return;
		}

		// Skip tiny icons / decorative images.
		//
		// Measured rather than read straight off the element: an image that is
		// still downloading reports a natural size of 0, so this took every photo
		// in a slow-loading article for a 0x0 icon and a click on one did nothing
		// whatsoever. The build's own `width`/`height` answer for it. An image
		// nothing can measure is still treated as decoration, which is what an
		// unmeasurable image on this site is.
		//
		// It is the article's image that is measured here, not the file the
		// lightbox would show: the question is whether the thing on the page is an
		// icon, and `data-lightbox-src` says nothing about that either way.
		const size = elementSize(img);
		if (!size || (size.width < 100 && size.height < 100)) return;
		e.preventDefault();
		openLightbox([toItem(img)], 0);
	}

	node.addEventListener('click', handleClick);

	return {
		destroy() {
			node.removeEventListener('click', handleClick);
		}
	};
}

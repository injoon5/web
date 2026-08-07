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

function toItem(img) {
	return {
		src: fullSrc(img),
		// A caption may be worth more than the alt text, and the two are not the
		// same job — `data-lightbox-caption` says the visible one out loud.
		alt: img.dataset?.lightboxCaption ?? img.alt,
		naturalWidth: img.naturalWidth,
		naturalHeight: img.naturalHeight,
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

export function lazyImagesAction(node) {
	node.querySelectorAll('img').forEach((img) => {
		img.setAttribute('loading', 'lazy');
	});
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

		// Skip tiny icons / decorative images
		if (img.naturalWidth < 100 && img.naturalHeight < 100) return;
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

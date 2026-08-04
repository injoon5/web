import { writable } from 'svelte/store';

/**
 * `null` = closed. Open is `{ items, index }`, where an item is
 * `{ src, alt, naturalWidth, naturalHeight }`.
 *
 * A bare item is still accepted — `Lightbox.svelte` normalises it into a
 * one-image group — so anything that set this store before groups existed keeps
 * working.
 */
export const lightboxStore = writable(null);

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

function toItem(img) {
	return {
		src: img.currentSrc || img.src,
		alt: img.alt,
		naturalWidth: img.naturalWidth,
		naturalHeight: img.naturalHeight
	};
}

export function lazyImagesAction(node) {
	node.querySelectorAll('img').forEach((img) => {
		img.setAttribute('loading', 'lazy');
	});
}

export function lightboxAction(node) {
	lazyImagesAction(node);

	function handleClick(e) {
		const img = e.target.closest('img');
		if (!img) return;
		// Skip images inside links — the user may want to navigate
		if (img.closest('a')) return;

		// A gallery opens as a group, so the lightbox can page through it. The
		// grouping is declared in the markup (`data-lightbox-group`) rather than
		// guessed from sibling images, so an ordinary article of unrelated
		// screenshots doesn't turn into one long slideshow.
		const group = img.closest('[data-lightbox-group]');
		if (group) {
			const images = Array.from(group.querySelectorAll('img'));
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

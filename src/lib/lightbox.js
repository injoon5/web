import { writable } from 'svelte/store';

export const lightboxStore = writable(null); // null = closed, { src, alt } = open

export function lightboxAction(node) {
	function handleClick(e) {
		const img = e.target.closest('img');
		if (!img) return;
		// Skip images inside links — the user may want to navigate
		if (img.closest('a')) return;
		// Skip tiny icons / decorative images
		if (img.naturalWidth < 100 && img.naturalHeight < 100) return;
		e.preventDefault();
		lightboxStore.set({ src: img.currentSrc || img.src, alt: img.alt, sourceRect: img.getBoundingClientRect() });
	}

	node.addEventListener('click', handleClick);

	return {
		destroy() {
			node.removeEventListener('click', handleClick);
		}
	};
}

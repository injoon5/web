/**
 * Hide images that fail to load inside `container`, so each tile shows the
 * placeholder colour behind it instead of the browser's broken-image icon with
 * the alt text spilled across it. Marks the element `data-broken`; `app.css`
 * does the hiding.
 *
 * On the container, not on each `<img>`: an action or listener on an `<img>`
 * makes Svelte render `onload="this.__e=event"` / `onerror=…` attributes, which
 * the Content-Security-Policy refuses as inline handlers. `error` does not
 * bubble, so it is caught in the capture phase. Images that failed before
 * hydration fired their event before anyone listened, so they are checked once
 * on mount, and again whenever the list re-renders.
 *
 * @param {HTMLElement} container
 */
export function hideBrokenImages(container) {
	/** @param {Element} img */
	const mark = (img) => img.setAttribute('data-broken', '');
	const scan = () => {
		for (const img of container.querySelectorAll('img')) {
			if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) mark(img);
		}
	};
	/** @param {Event} e */
	const onError = (e) => {
		if (e.target instanceof HTMLImageElement) mark(e.target);
	};

	container.addEventListener('error', onError, true);
	scan();
	const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(scan);
	observer?.observe(container, { childList: true, subtree: true });

	return {
		destroy() {
			container.removeEventListener('error', onError, true);
			observer?.disconnect();
		}
	};
}

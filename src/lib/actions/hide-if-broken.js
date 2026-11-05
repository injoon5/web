/**
 * Hide an image that failed to load, so its tile shows the placeholder colour
 * behind it instead of the browser's broken-image icon with the alt text spilled
 * across it. Marks the element `data-broken`; `app.css` does the hiding.
 *
 * Checks on mount as well: an image that failed before hydration fired its
 * `error` event before anyone was listening.
 *
 * @param {HTMLImageElement} img
 */
export function hideIfBroken(img) {
	const mark = () => img.setAttribute('data-broken', '');
	if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) mark();
	img.addEventListener('error', mark);
	return { destroy: () => img.removeEventListener('error', mark) };
}

/**
 * The plumbing that makes a portalled div behave like a modal: the page behind
 * cannot scroll, cannot be reached by assistive tech, and the browser chrome
 * matches the scrim.
 *
 * Kept out of the component because none of it is reactive — it is save/restore
 * bookkeeping against globals, and each piece has to be undone in the same shape
 * it was applied.
 */
export function createModalHost({ themeColor }) {
	/** @type {Array<{ el: Element, content: string | null, media: string | null, injected?: boolean }> | null} */
	let savedThemeColor = null;
	/** @type {{ overflow: string, paddingRight: string } | null} */
	let scrollLock = null;
	/** @type {Array<{ el: Element, inert: string | null, hidden: string | null }>} */
	let inerted = [];

	// Darken the mobile address bar to match the dark blurred backdrop instead of
	// the page's own light/dark theme.
	function applyThemeColor() {
		if (typeof document === 'undefined' || savedThemeColor) return;
		const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
		if (metas.length === 0) {
			const el = document.createElement('meta');
			el.setAttribute('name', 'theme-color');
			el.setAttribute('content', themeColor);
			document.head.appendChild(el);
			savedThemeColor = [{ el, content: null, media: null, injected: true }];
			return;
		}
		// Drop the media gate and force dark so the override wins in any scheme.
		savedThemeColor = metas.map((el) => ({
			el,
			content: el.getAttribute('content'),
			media: el.getAttribute('media')
		}));
		for (const { el } of savedThemeColor) {
			el.removeAttribute('media');
			el.setAttribute('content', themeColor);
		}
	}

	function restoreThemeColor() {
		if (!savedThemeColor) return;
		for (const entry of savedThemeColor) {
			if (entry.injected) {
				entry.el.remove();
				continue;
			}
			if (entry.content === null) entry.el.removeAttribute('content');
			else entry.el.setAttribute('content', entry.content);
			if (entry.media === null) entry.el.removeAttribute('media');
			else entry.el.setAttribute('media', entry.media);
		}
		savedThemeColor = null;
	}

	// Compensating for the scrollbar's width keeps the (blurred, still visible)
	// page from jumping sideways as it disappears.
	function lockScroll() {
		if (typeof document === 'undefined' || scrollLock) return;
		const body = document.body;
		const gap = window.innerWidth - document.documentElement.clientWidth;
		scrollLock = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
		body.style.overflow = 'hidden';
		// A scrollbar is a scrollbar, never half the window — anything wider is a
		// browser (or a jsdom) that does not lay out at all.
		if (gap > 0 && gap < 40) body.style.paddingRight = `${gap}px`;
	}

	function unlockScroll() {
		if (!scrollLock) return;
		document.body.style.overflow = scrollLock.overflow;
		document.body.style.paddingRight = scrollLock.paddingRight;
		scrollLock = null;
	}

	/**
	 * `aria-modal` is a promise that the rest of the page is unreachable; `inert`
	 * is what makes it true. Applied to <body>'s children rather than a wrapper,
	 * because the dialog is portalled there.
	 * @param {Element} root
	 */
	function inertBackground(root) {
		if (typeof document === 'undefined' || !root) return;
		for (const el of Array.from(document.body.children)) {
			if (el === root || el.contains(root)) continue;
			if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') continue;
			inerted.push({ el, inert: el.getAttribute('inert'), hidden: el.getAttribute('aria-hidden') });
			el.setAttribute('inert', '');
			el.setAttribute('aria-hidden', 'true');
		}
	}

	function releaseBackground() {
		for (const { el, inert, hidden } of inerted) {
			if (inert === null) el.removeAttribute('inert');
			else el.setAttribute('inert', inert);
			if (hidden === null) el.removeAttribute('aria-hidden');
			else el.setAttribute('aria-hidden', hidden);
		}
		inerted = [];
	}

	return {
		open() {
			applyThemeColor();
			lockScroll();
		},
		close() {
			restoreThemeColor();
			unlockScroll();
			// Release before the caller restores focus: focus cannot land inside an
			// inert tree.
			releaseBackground();
		},
		inertBackground,
		releaseBackground
	};
}

/** Everything inside the dialog a Tab can legitimately land on. */
export function focusablesIn(root) {
	if (!root) return [];
	return Array.from(
		root.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]')
	);
}

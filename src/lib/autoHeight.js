/**
 * Animates wrapper height when inner crossfade content changes size.
 * Attach to an overflow-hidden shell around a `[data-auto-height-inner]` grid.
 *
 * @param {HTMLElement} node
 * @param {{ duration?: number; enabled?: boolean }} params
 */
export function autoHeight(node, params = {}) {
	let duration = params.duration ?? 420;
	let enabled = params.enabled ?? true;
	let inner = node.querySelector('[data-auto-height-inner]');
	let initialized = false;
	let lockedUntil = 0;
	let activeOutros = 0;
	let raf = 0;
	/** @type {ResizeObserver | undefined} */
	let ro;
	/** @type {MutationObserver | undefined} */
	let mo;

	/** @param {Element} el */
	function contentHeight(el) {
		return Math.max(el.offsetHeight, el.scrollHeight);
	}

	function measure() {
		if (!inner) return 0;
		const { children } = inner;
		if (children.length === 0) return 0;
		// During crossfade the outgoing node stays first; incoming is last.
		// Use incoming height so shrink doesn't read the stretched grid cell.
		if (children.length === 1) return contentHeight(children[0]);
		return contentHeight(children[children.length - 1]);
	}

	function apply(next, fromOverride) {
		if (!enabled || !duration) {
			node.style.height = `${next}px`;
			initialized = true;
			return;
		}

		const from = fromOverride ?? node.offsetHeight;
		const hasExplicitHeight = node.style.height && node.style.height !== 'auto';

		if (!hasExplicitHeight && !initialized) {
			node.style.height = `${next}px`;
			initialized = true;
			return;
		}

		if (from === next) {
			node.style.height = `${next}px`;
			return;
		}

		node.style.transition = 'none';
		node.style.height = `${from}px`;
		node.offsetHeight;
		node.style.transition = `height ${duration}ms cubic-bezier(0.215, 0.61, 0.355, 1)`;
		node.style.height = `${next}px`;
		initialized = true;
	}

	/** @param {Event} event */
	function onIntroStart(event) {
		const target = /** @type {HTMLElement} */ (event.target);
		if (!inner?.contains(target)) return;

		let el = target;
		while (el.parentElement && el.parentElement !== inner) {
			el = el.parentElement;
		}

		lockedUntil = performance.now() + duration;
		cancelAnimationFrame(raf);
		apply(contentHeight(el));
	}

	function syncFromObserver() {
		if (performance.now() < lockedUntil || activeOutros > 0) return;
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => apply(measure()));
	}

	/** @param {Event} event */
	function onOutroStart(event) {
		if (!inner?.contains(/** @type {Node} */ (event.target))) return;
		activeOutros++;
	}

	/** @param {Event} event */
	function onOutroEnd(event) {
		if (!inner?.contains(/** @type {Node} */ (event.target))) return;
		activeOutros = Math.max(0, activeOutros - 1);
		if (activeOutros === 0) {
			lockedUntil = 0;
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => apply(measure()));
		}
	}

	function observeChildren() {
		if (!inner || !ro) return;
		for (const child of inner.children) {
			ro.observe(child);
		}
	}

	if (inner) {
		// Prevent grid stretch from inflating the incoming node to the outgoing height.
		inner.style.alignItems = 'start';

		inner.addEventListener('introstart', onIntroStart, true);
		inner.addEventListener('outrostart', onOutroStart, true);
		inner.addEventListener('outroend', onOutroEnd, true);

		ro = new ResizeObserver(syncFromObserver);
		ro.observe(inner);
		observeChildren();
		mo = new MutationObserver(() => {
			observeChildren();
			syncFromObserver();
		});
		mo.observe(inner, { childList: true });
		apply(measure());
	}

	return {
		update(p) {
			duration = p.duration ?? 420;
			enabled = p.enabled ?? true;
			syncFromObserver();
		},
		destroy() {
			cancelAnimationFrame(raf);
			inner?.removeEventListener('introstart', onIntroStart, true);
			inner?.removeEventListener('outrostart', onOutroStart, true);
			inner?.removeEventListener('outroend', onOutroEnd, true);
			ro?.disconnect();
			mo?.disconnect();
		}
	};
}

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
	let raf = 0;
	/** @type {ResizeObserver | undefined} */
	let ro;
	/** @type {MutationObserver | undefined} */
	let mo;

	function measure() {
		if (!inner) return 0;
		let max = inner.scrollHeight;
		for (const child of inner.children) {
			max = Math.max(max, child.scrollHeight, child.offsetHeight);
		}
		return max;
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
		// Use scrollHeight (natural content height) rather than offsetHeight, which
		// can be inflated by CSS Grid's align-self:stretch when a taller sibling
		// sets the row height. That made height-decrease transitions start only
		// after the outgoing element left the DOM instead of with the blur.
		apply(el.scrollHeight);
	}

	function syncFromObserver() {
		if (performance.now() < lockedUntil) return;
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => apply(measure()));
	}

	function observeChildren() {
		if (!inner || !ro) return;
		for (const child of inner.children) {
			ro.observe(child);
		}
	}

	if (inner) {
		inner.addEventListener('introstart', onIntroStart, true);

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
			ro?.disconnect();
			mo?.disconnect();
		}
	};
}

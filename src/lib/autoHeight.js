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

	function apply(next) {
		if (!enabled || !duration) {
			node.style.height = `${next}px`;
			return;
		}

		const from = node.offsetHeight;
		const hasExplicitHeight = node.style.height && node.style.height !== 'auto';

		if (!hasExplicitHeight) {
			node.style.height = `${next}px`;
			return;
		}

		if (from === next) return;

		node.style.transition = 'none';
		node.style.height = `${from}px`;
		node.offsetHeight;
		node.style.transition = `height ${duration}ms cubic-bezier(0, 0, 0.58, 1)`;
		node.style.height = `${next}px`;
	}

	function sync() {
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => apply(measure()));
	}

	let raf = 0;

	function observeChildren() {
		if (!inner || !ro) return;
		for (const child of inner.children) {
			ro.observe(child);
		}
	}

	if (inner) {
		ro = new ResizeObserver(sync);
		ro.observe(inner);
		observeChildren();
		mo = new MutationObserver(() => {
			observeChildren();
			sync();
		});
		mo.observe(inner, { childList: true });
		sync();
	}

	return {
		update(p) {
			duration = p.duration ?? 420;
			enabled = p.enabled ?? true;
			sync();
		},
		destroy() {
			ro?.disconnect();
			mo?.disconnect();
		}
	};
}

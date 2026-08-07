/**
 * The shared-element flight: the photo travels from the box it holds in the
 * article to the box it holds full-screen, and back.
 *
 * Driven through the Web Animations API rather than a class or an inline
 * transform. WAAPI runs off the main thread, and — unlike an imperative
 * `style.transform` — Svelte rewriting the `style` attribute mid-flight cannot
 * wipe it out.
 */

export const IDENTITY = 'translate3d(0px, 0px, 0) scale(1)';

/** @param {{ x: number, y: number, scale: number }} f */
export const flightTransform = (f) => `translate3d(${f.x}px, ${f.y}px, 0) scale(${f.scale})`;

/**
 * Bring the element the lightbox is about to fly back to into view inside its
 * own scroller, so closing on the fourth image of a strip lands on the fourth
 * image rather than off the side of it. Horizontal scrollers only, and never the
 * page — that one is locked while the lightbox is open.
 *
 * @param {HTMLElement} el
 */
export function alignOrigin(el) {
	for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
		if (node.scrollWidth - node.clientWidth < 2) continue;
		const overflowX = getComputedStyle(node).overflowX;
		if (overflowX !== 'auto' && overflowX !== 'scroll') continue;
		// This scroll has to land before the flight is measured a line later. A
		// scroller with `scroll-behavior: smooth` would animate instead, and the
		// flight would be measured against a position it has not reached yet.
		const behaviour = node.style.scrollBehavior;
		node.style.scrollBehavior = 'auto';
		const r = el.getBoundingClientRect();
		const cr = node.getBoundingClientRect();
		node.scrollLeft += r.left + r.width / 2 - (cr.left + cr.width / 2);
		node.style.scrollBehavior = behaviour;
	}
}

/**
 * Has the element been scrolled or laid out clean off the screen?
 * @param {HTMLElement} el
 * @param {number} winW
 * @param {number} winH
 */
export function isOffScreen(el, winW, winH) {
	const r = el.getBoundingClientRect();
	return r.bottom <= 0 || r.top >= winH || r.right <= 0 || r.left >= winW;
}

/**
 * Runs one flight at a time and keeps a handle on it.
 *
 * A stale handler must never clear its successor — `oncancel` is dispatched
 * asynchronously, so it can land after the animation that replaced it has
 * already been stored.
 */
export function createFlightRunner() {
	/** @type {Animation | null} */
	let current = null;

	return {
		cancel() {
			current?.cancel();
		},
		/**
		 * `fill` is the whole difference between the two directions. On the way in,
		 * `backwards` puts the photo at its origin for the first paint and then
		 * hands the transform back, so pan and zoom work the moment it lands. On the
		 * way out, `forwards` holds it at the origin for the frame between the
		 * animation ending and the lightbox unmounting — without it the photo snaps
		 * back to full size for that frame.
		 */
		run(el, keyframes, duration, fill, easing, onfinish) {
			const anim = el.animate(keyframes, { duration, easing, fill });
			current = anim;
			anim.oncancel = () => {
				if (current === anim) current = null;
			};
			anim.onfinish = () => {
				if (current === anim) current = null;
				onfinish?.();
			};
			return anim;
		}
	};
}

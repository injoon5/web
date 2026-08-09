/**
 * The lightbox's pure geometry. Nothing here touches the DOM or component
 * state, which is what makes the sizing, paging and settle maths testable
 * without a browser.
 */

/**
 * Displayed size, computed the way `object-fit: contain` would but from known
 * natural dimensions, so the box has its final size before the src loads.
 * Never upscales.
 *
 * @param {{ naturalWidth?: number, naturalHeight?: number } | null} item
 * @param {number} availW
 * @param {number} availH
 * @returns {{ w: number, h: number } | null}
 */
export function containSize(item, availW, availH) {
	if (!item?.naturalWidth || !item?.naturalHeight || !availW || !availH) return null;
	const s = Math.min(availW / item.naturalWidth, availH / item.naturalHeight, 1);
	return { w: Math.round(item.naturalWidth * s), h: Math.round(item.naturalHeight * s) };
}

/**
 * The largest box of a given aspect ratio that fits the space — upscaling if it
 * has to, which is the one thing `containSize` will not do.
 *
 * This is for the image whose own size is not known yet but whose shape is:
 * `data-lightbox-src` points at a *larger* file than the article's, so the
 * thumbnail's dimensions are a floor, not a size. Filling the space is the right
 * guess for it, and it gives the placeholder and the article's own pixels a box
 * to sit in instead of nothing.
 *
 * @param {number} ratio width / height
 * @param {number} availW
 * @param {number} availH
 * @returns {{ w: number, h: number } | null}
 */
export function ratioFit(ratio, availW, availH) {
	if (!ratio || !Number.isFinite(ratio) || ratio <= 0 || !availW || !availH) return null;
	const w = Math.min(availW, availH * ratio);
	return { w: Math.round(w), h: Math.round(w / ratio) };
}

/**
 * The transform that moves an element from the box it lays out in to some other
 * box on screen.
 *
 * One uniform scale, not a separate scaleX and scaleY: both ends are
 * `object-fit: contain` around the same file, so their aspect ratios agree and a
 * second axis could only distort the photo in flight.
 *
 * @param {DOMRect | null} base
 * @param {DOMRect | null} target
 * @returns {{ scale: number, x: number, y: number } | null}
 */
export function deltaBetween(base, target) {
	if (!base || !target) return null;
	if (base.width < 1 || base.height < 1 || target.width < 1 || target.height < 1) return null;
	return {
		scale: target.width / base.width,
		x: target.left + target.width / 2 - (base.left + base.width / 2),
		y: target.top + target.height / 2 - (base.top + base.height / 2)
	};
}

/**
 * iOS's rubber band: resistance that grows with distance, asymptotic to `dim`.
 *
 * @param {number} delta
 * @param {number} dim
 * @param {number} constant
 */
export function rubber(delta, dim, constant) {
	const sign = Math.sign(delta);
	const a = Math.abs(delta);
	return (sign * (a * dim * constant)) / (dim + constant * a) || 0;
}

/**
 * Pan offsets clamped to the scaled image's own edges.
 *
 * @param {{ w: number, h: number }} fit
 * @param {number} scale
 * @param {number} availW
 * @param {number} availH
 * @param {number} panX
 * @param {number} panY
 */
export function clampPanTo(fit, scale, availW, availH, panX, panY) {
	const maxX = Math.max(0, (fit.w * scale - availW) / 2);
	const maxY = Math.max(0, (fit.h * scale - availH) / 2);
	return {
		x: Math.max(-maxX, Math.min(maxX, panX)),
		y: Math.max(-maxY, Math.min(maxY, panY))
	};
}

/**
 * Re-anchor the pan so the point under the fingers/cursor stays put through a
 * scale change.
 *
 * @param {{ nextScale: number, baseScale: number, x: number, y: number,
 *          centreX: number, centreY: number, panX: number, panY: number }} args
 */
export function panAfterScale({ nextScale, baseScale, x, y, centreX, centreY, panX, panY }) {
	const r = nextScale / baseScale;
	return {
		x: (1 - r) * (x - centreX) + r * panX,
		y: (1 - r) * (y - centreY) + r * panY
	};
}

/**
 * Which way a released horizontal gesture pages: -1, 0 or +1. A fast flick that
 * barely moved pages, and so does a slow drag past `ratio` of the viewport —
 * distance alone made a real flick feel ignored.
 *
 * @param {number} travelled
 * @param {number} velocity
 * @param {number} page
 * @param {{ lock: number, ratio: number, flickVelocity: number }} limits
 */
export function pageStep(travelled, velocity, page, { lock, ratio, flickVelocity }) {
	const flick = Math.abs(velocity) > flickVelocity && Math.abs(travelled) > lock;
	const far = Math.abs(travelled) > (page || 1) * ratio;
	if (!flick && !far) return 0;
	return travelled < 0 ? 1 : -1;
}

/**
 * How long a settle should take and how fast it should leave, given what is
 * left to travel and the speed the gesture ended at.
 *
 * Duration scales with the square root of the distance, so a small correction
 * is not over before it can be seen. `v0` is capped where a critically damped
 * spring starts to overshoot — a page sailing past its slot and coming back is a
 * bounce the scroller outside does not have. Negative is a release still
 * travelling out of a rubber band, which does carry on and return.
 *
 * @param {number} remaining
 * @param {number} page
 * @param {number} velocity
 * @param {{ min: number, max: number, v0Min: number, v0Max: number }} limits
 * @returns {{ duration: number, v0: number } | null}
 */
export function settleSpec(remaining, page, velocity, { min, max, v0Min, v0Max }) {
	const distance = Math.abs(remaining);
	if (distance < 1) return null;
	const duration = Math.round(Math.max(min, Math.min(max, max * Math.sqrt(distance / page))));
	const along = (velocity * Math.sign(remaining) * duration) / distance;
	return { duration, v0: Math.max(v0Min, Math.min(v0Max, along)) };
}

/**
 * Pointer velocity over a trailing window.
 *
 * A release is judged on the whole window rather than on the last pointermove:
 * two events 4ms apart on a 120Hz screen make a single-sample velocity mostly
 * noise, which is what let an obvious flick fail to page and a careful nudge
 * shoot away. A finger that has been resting sends no moves at all, so its
 * samples fall out of the window and it has no velocity — which is right.
 *
 * @param {number} windowMs
 */
export function createVelocityTracker(windowMs) {
	/** @type {Array<{ x: number, y: number, t: number }>} */
	let samples = [];

	return {
		/** @param {number} x @param {number} y @param {number} t */
		reset(x, y, t) {
			samples = [{ x, y, t }];
		},
		clear() {
			samples = [];
		},
		/** @param {number} x @param {number} y @param {number} t */
		push(x, y, t) {
			samples.push({ x, y, t });
			if (samples.length > 16) samples.shift();
		},
		/**
		 * px/ms over the window ending at `now`.
		 * @param {number} now
		 */
		at(now) {
			let first = null;
			for (const s of samples) {
				if (now - s.t <= windowMs) {
					first = s;
					break;
				}
			}
			const last = samples[samples.length - 1];
			if (!first || !last || first === last) return { x: 0, y: 0 };
			const dt = last.t - first.t;
			if (dt <= 0) return { x: 0, y: 0 };
			return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
		}
	};
}

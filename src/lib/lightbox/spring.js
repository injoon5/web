/**
 * A damped oscillator written out as a `linear()` easing, so WAAPI and CSS
 * still run it on the compositor — a real spring, not a curve resembling one.
 *
 * `bounce` is the damping ratio read the other way up: 0 settles without ever
 * passing its mark, 0.25 passes it by about 3%.
 *
 * `velocity` is what the spring is already travelling at when it starts, in
 * fractions of the distance per unit of the animation's own duration. A settle
 * handed the speed the finger left at is continuous with the gesture; a fixed
 * curve leaves at the same rate whether the photo was thrown or nudged.
 *
 * @param {number} bounce
 * @param {number} [velocity]
 * @param {number} [steps]
 * @returns {string}
 */
export function springEasing(bounce, velocity = 0, steps = 32) {
	const zeta = Math.min(1, Math.max(0.05, 1 - bounce));
	const omega = 2 * Math.PI;
	const omegaD = omega * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
	const points = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const v =
			zeta < 1
				? 1 -
					Math.exp(-zeta * omega * t) *
						(Math.cos(omegaD * t) + ((zeta * omega - velocity) / omegaD) * Math.sin(omegaD * t))
				: 1 + (-1 + (velocity - omega) * t) * Math.exp(-omega * t);
		points.push(Math.round(v * 1e4) / 1e4);
	}
	points[points.length - 1] = 1;
	return `linear(${points.join(',')})`;
}

let linearEasing;

/**
 * `spring` where `linear()` is supported, `fallback` where it is not.
 * @param {string} fallback
 * @param {string} spring
 */
export function springOr(fallback, spring) {
	linearEasing ??= !!globalThis.CSS?.supports?.('animation-timing-function', 'linear(0, 1)');
	return linearEasing ? spring : fallback;
}

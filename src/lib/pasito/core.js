/**
 * The framework-agnostic half of pasito, ported from
 * https://github.com/joshpuckett/pasito (`packages/pasito/src/core`). Upstream
 * ships React and Vue wrappers around this core; the Svelte one lives next door.
 * Keeping the logic here is what makes it testable without a DOM.
 */

/**
 * Step geometry, in px. Must agree with the `--pill-*` defaults in
 * `Stepper.svelte` — this turns a step index into a pixel offset, so changing
 * the dot size in CSS alone slides the track wrong.
 */
export const DEFAULT_METRICS = { dotSize: 8, activeWidth: 24, gap: 6 };

/**
 * Where to slide the track, and how wide to hold the container, when there are
 * more steps than `maxVisible`.
 *
 * @param {number} count total steps
 * @param {number} active zero-based active index
 * @param {number | undefined} maxVisible steps visible before windowing kicks in
 * @param {'horizontal' | 'vertical'} orientation
 * @param {{ dotSize: number, activeWidth: number, gap: number }} [metrics]
 * @returns {{ windowStart: number, transformValue: string, containerSize: number | undefined }}
 */
export function computeStepWindow(
	count,
	active,
	maxVisible,
	orientation,
	metrics = DEFAULT_METRICS
) {
	if (maxVisible == null || count <= maxVisible) {
		return { windowStart: 0, transformValue: 'none', containerSize: undefined };
	}

	const { dotSize, activeWidth, gap } = metrics;
	const slotSize = dotSize + gap;

	const half = Math.floor(maxVisible / 2);
	// Centre the active step in the window, but never scroll past either end.
	const windowStart = Math.max(0, Math.min(active - half, count - maxVisible));

	const offset = windowStart * slotSize;
	const axis = orientation === 'vertical' ? 'Y' : 'X';

	return {
		windowStart,
		transformValue: `translate${axis}(-${offset}px)`,
		// (maxVisible - 1) dots + one active pill + the gaps between them.
		containerSize: (maxVisible - 1) * dotSize + activeWidth + (maxVisible - 1) * gap
	};
}

/**
 * @typedef {{ key: number, index: number, phase: 'entering' | 'stable' | 'exiting' }} AnimatingStep
 */

/**
 * A stable, keyed list of steps across count changes, so an added or removed
 * step can animate. A removed step stays with phase `exiting` until its
 * transition has run, which is why this is mutable rather than pure.
 */
export class StepAnimator {
	/** @param {number} count */
	constructor(count) {
		this.keyGen = count;
		/** @type {AnimatingStep[]} */
		this.steps = Array.from({ length: count }, (_, i) => ({
			key: i,
			index: i,
			phase: /** @type {const} */ ('stable')
		}));
	}

	/**
	 * Fold a new count into the list.
	 * @param {number} newCount
	 * @returns {{ hasEntering: boolean, exitingCount: number }}
	 */
	reconcile(newCount) {
		const liveCount = this.steps.filter((s) => s.phase !== 'exiting').length;
		if (liveCount === newCount) return this.#summary();

		if (newCount < liveCount) {
			let seen = 0;
			this.steps = this.steps.map((s) => {
				if (s.phase === 'exiting') return s;
				seen++;
				if (seen > newCount) return { ...s, phase: /** @type {const} */ ('exiting') };
				return s;
			});
		}

		if (newCount > liveCount) {
			for (let i = liveCount; i < newCount; i++) {
				this.keyGen++;
				this.steps.push({
					key: this.keyGen,
					index: i,
					phase: /** @type {const} */ ('entering')
				});
			}
		}

		// Re-index the live steps; exiting ones keep the index they died at.
		let idx = 0;
		this.steps = this.steps.map((s) => (s.phase === 'exiting' ? s : { ...s, index: idx++ }));

		return this.#summary();
	}

	/** Entering steps have painted their collapsed state — let them expand. */
	promoteEntering() {
		this.steps = this.steps.map((s) =>
			s.phase === 'entering' ? { ...s, phase: /** @type {const} */ ('stable') } : s
		);
	}

	/** Their transitions have run; drop them from the list. */
	removeExiting() {
		this.steps = this.steps.filter((s) => s.phase !== 'exiting');
	}

	/** @returns {AnimatingStep[]} */
	getSteps() {
		return [...this.steps];
	}

	#summary() {
		return {
			hasEntering: this.steps.some((s) => s.phase === 'entering'),
			exitingCount: this.steps.filter((s) => s.phase === 'exiting').length
		};
	}
}

/** Which step autoplay should advance to, or null when it has run out. */
export class AutoPlayController {
	/** @param {{ stepDuration?: number, loop?: boolean }} [options] */
	constructor({ stepDuration = 3000, loop = true } = {}) {
		this.stepDuration = stepDuration;
		this.loop = loop;
	}

	/**
	 * @param {number} active
	 * @param {number} count
	 * @returns {number | null}
	 */
	computeNext(active, count) {
		return active < count - 1 ? active + 1 : this.loop ? 0 : null;
	}
}

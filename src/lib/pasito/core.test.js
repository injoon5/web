import { describe, it, expect } from 'vitest';
import { computeStepWindow, StepAnimator, AutoPlayController, DEFAULT_METRICS } from './core.js';

describe('computeStepWindow', () => {
	it('does not window when every step fits', () => {
		expect(computeStepWindow(4, 1, undefined, 'horizontal')).toEqual({
			windowStart: 0,
			transformValue: 'none',
			containerSize: undefined
		});
		expect(computeStepWindow(5, 1, 5, 'horizontal').transformValue).toBe('none');
	});

	it('centres the active step once the count passes maxVisible', () => {
		const { windowStart, transformValue } = computeStepWindow(20, 10, 5, 'horizontal');
		expect(windowStart).toBe(8); // 10 - floor(5 / 2)
		expect(transformValue).toBe(
			`translateX(-${8 * (DEFAULT_METRICS.dotSize + DEFAULT_METRICS.gap)}px)`
		);
	});

	it('stops the window at both ends instead of scrolling past them', () => {
		expect(computeStepWindow(20, 0, 5, 'horizontal').windowStart).toBe(0);
		expect(computeStepWindow(20, 19, 5, 'horizontal').windowStart).toBe(15); // count - maxVisible
	});

	it('translates along Y when vertical', () => {
		expect(computeStepWindow(20, 10, 5, 'vertical').transformValue).toMatch(/^translateY\(/);
	});

	it('sizes the container to the dots, the pill and the gaps between them', () => {
		const { dotSize, activeWidth, gap } = DEFAULT_METRICS;
		expect(computeStepWindow(20, 0, 5, 'horizontal').containerSize).toBe(
			4 * dotSize + activeWidth + 4 * gap
		);
	});
});

describe('StepAnimator', () => {
	const phases = (a) => a.getSteps().map((s) => s.phase);
	const indices = (a) => a.getSteps().map((s) => s.index);

	it('starts with every step stable and in order', () => {
		const animator = new StepAnimator(3);
		expect(phases(animator)).toEqual(['stable', 'stable', 'stable']);
		expect(indices(animator)).toEqual([0, 1, 2]);
	});

	it('reconciling to the same count changes nothing', () => {
		const animator = new StepAnimator(3);
		const before = animator.getSteps();
		expect(animator.reconcile(3)).toEqual({ hasEntering: false, exitingCount: 0 });
		expect(animator.getSteps()).toEqual(before);
	});

	it('marks added steps entering, then promotes them', () => {
		const animator = new StepAnimator(2);
		expect(animator.reconcile(4)).toEqual({ hasEntering: true, exitingCount: 0 });
		expect(phases(animator)).toEqual(['stable', 'stable', 'entering', 'entering']);

		animator.promoteEntering();
		expect(phases(animator)).toEqual(['stable', 'stable', 'stable', 'stable']);
		expect(indices(animator)).toEqual([0, 1, 2, 3]);
	});

	it('gives added steps fresh keys so they are not reused across churn', () => {
		const animator = new StepAnimator(2);
		animator.reconcile(3);
		animator.promoteEntering();
		animator.reconcile(2);
		animator.removeExiting();
		animator.reconcile(3);

		const keys = animator.getSteps().map((s) => s.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('keeps removed steps around as exiting until they are cleared', () => {
		const animator = new StepAnimator(4);
		expect(animator.reconcile(2)).toEqual({ hasEntering: false, exitingCount: 2 });
		expect(phases(animator)).toEqual(['stable', 'stable', 'exiting', 'exiting']);
		// The two survivors keep indices 0 and 1 — the exiting pair is not counted.
		expect(
			animator
				.getSteps()
				.filter((s) => s.phase !== 'exiting')
				.map((s) => s.index)
		).toEqual([0, 1]);

		animator.removeExiting();
		expect(phases(animator)).toEqual(['stable', 'stable']);
	});

	it('counts only live steps, so a re-grow while steps are exiting is not double counted', () => {
		const animator = new StepAnimator(4);
		animator.reconcile(2); // two exiting, two live
		// Back to 4 before the exit finishes: two more enter rather than the
		// exiting pair silently satisfying the count.
		expect(animator.reconcile(4)).toEqual({ hasEntering: true, exitingCount: 2 });
		expect(animator.getSteps().filter((s) => s.phase !== 'exiting')).toHaveLength(4);
	});

	it('hands back a copy, so callers cannot mutate its list', () => {
		const animator = new StepAnimator(2);
		animator.getSteps().push({ key: 99, index: 99, phase: 'stable' });
		expect(animator.getSteps()).toHaveLength(2);
	});
});

describe('AutoPlayController', () => {
	it('advances one step at a time', () => {
		expect(new AutoPlayController().computeNext(0, 3)).toBe(1);
	});

	it('wraps at the end when looping', () => {
		expect(new AutoPlayController({ loop: true }).computeNext(2, 3)).toBe(0);
	});

	it('runs out at the end when not looping', () => {
		expect(new AutoPlayController({ loop: false }).computeNext(2, 3)).toBeNull();
	});
});

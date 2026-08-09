import { describe, expect, it } from 'vitest';
import {
	clampPanTo,
	clampTravel,
	containSize,
	deltaBetween,
	pageStep,
	panAfterScale,
	rubber,
	settleSpec
} from './geometry.js';

const rect = (left, top, width, height) => ({ left, top, width, height });

describe('containSize', () => {
	it('fits a wide image to the available width', () => {
		expect(containSize({ naturalWidth: 2000, naturalHeight: 1000 }, 800, 600)).toEqual({
			w: 800,
			h: 400
		});
	});

	it('never upscales — plenty of images in these posts are 200px wide', () => {
		expect(containSize({ naturalWidth: 200, naturalHeight: 100 }, 800, 600)).toEqual({
			w: 200,
			h: 100
		});
	});

	it('has no size to give without natural dimensions or a viewport', () => {
		expect(containSize({ naturalWidth: 0, naturalHeight: 0 }, 800, 600)).toBeNull();
		expect(containSize({ naturalWidth: 100, naturalHeight: 100 }, 0, 600)).toBeNull();
		expect(containSize(null, 800, 600)).toBeNull();
	});
});

describe('deltaBetween', () => {
	it('is one uniform scale, never a separate x and y', () => {
		const d = deltaBetween(rect(0, 0, 100, 50), rect(200, 100, 400, 200));
		expect(d).toEqual({ scale: 4, x: 350, y: 175 });
	});

	it('refuses a degenerate box rather than returning Infinity', () => {
		expect(deltaBetween(rect(0, 0, 0, 0), rect(0, 0, 10, 10))).toBeNull();
		expect(deltaBetween(null, rect(0, 0, 10, 10))).toBeNull();
	});
});

describe('rubber', () => {
	it('asymptotes rather than stopping dead', () => {
		const near = rubber(100, 400, 0.55);
		const far = rubber(10000, 400, 0.55);
		expect(near).toBeLessThan(100);
		expect(far).toBeGreaterThan(near);
		// Asymptotic to the dimension itself, never reaching it.
		expect(far).toBeLessThan(400);
	});

	it('keeps the sign of the drag and maps zero to zero', () => {
		expect(rubber(-100, 400, 0.55)).toBeLessThan(0);
		expect(rubber(0, 400, 0.55)).toBe(0);
	});
});

describe('clampTravel', () => {
	const PAGE = 400;
	const GIVE = PAGE * 0.1;

	it('leaves anything within reach exactly where it is', () => {
		expect(clampTravel(0, PAGE, GIVE, 0.55)).toBe(0);
		expect(clampTravel(-399, PAGE, GIVE, 0.55)).toBe(-399);
		expect(clampTravel(PAGE, PAGE, GIVE, 0.55)).toBe(PAGE);
	});

	it('resists past reach instead of stopping dead, and never passes the give', () => {
		const little = clampTravel(-PAGE - 100, PAGE, GIVE, 0.55);
		const lots = clampTravel(-PAGE - 100000, PAGE, GIVE, 0.55);
		expect(Math.abs(little)).toBeGreaterThan(PAGE);
		expect(Math.abs(lots)).toBeGreaterThan(Math.abs(little));
		expect(Math.abs(lots)).toBeLessThan(PAGE + GIVE);
	});

	it('holds a trackpad flick to the page the settle will honour', () => {
		// The measured case: 6000px of momentum on a 1100px viewport carried the
		// track 5.5 pages and then took four and a half of them back.
		const carried = clampTravel(-6000, 1100, 110, 0.55);
		expect(Math.abs(carried) / 1100).toBeLessThan(1.1);
	});

	it('gives only the give at an end, where there is no next image at all', () => {
		const pulled = clampTravel(4000, 0, GIVE, 0.55);
		expect(pulled).toBeGreaterThan(0);
		expect(pulled).toBeLessThan(GIVE);
	});
});

describe('clampPanTo', () => {
	it('clamps to the scaled image edges', () => {
		const fit = { w: 400, h: 200 };
		expect(clampPanTo(fit, 2, 400, 200, 999, 999)).toEqual({ x: 200, y: 100 });
		expect(clampPanTo(fit, 2, 400, 200, -999, -999)).toEqual({ x: -200, y: -100 });
	});

	it('pins an unzoomed image to centre — it has no slack to pan into', () => {
		expect(clampPanTo({ w: 400, h: 200 }, 1, 400, 200, 50, 50)).toEqual({ x: 0, y: 0 });
	});
});

describe('panAfterScale', () => {
	it('keeps the point under the finger put', () => {
		// Zooming about the exact centre should not shift the pan.
		expect(
			panAfterScale({
				nextScale: 2,
				baseScale: 1,
				x: 100,
				y: 100,
				centreX: 100,
				centreY: 100,
				panX: 0,
				panY: 0
			})
		).toEqual({ x: 0, y: 0 });
	});

	it('pushes the pan away from an off-centre anchor', () => {
		const { x } = panAfterScale({
			nextScale: 2,
			baseScale: 1,
			x: 200,
			y: 100,
			centreX: 100,
			centreY: 100,
			panX: 0,
			panY: 0
		});
		expect(x).toBe(-100);
	});
});

describe('pageStep', () => {
	const limits = { lock: 8, ratio: 0.2, flickVelocity: 0.4 };

	it('pages on a fast flick that barely moved', () => {
		expect(pageStep(-30, -1.2, 400, limits)).toBe(1);
	});

	it('pages on a slow drag past a fifth of the viewport', () => {
		expect(pageStep(-120, 0, 400, limits)).toBe(-0 + 1);
	});

	it('stays put on a short slow drag — distance alone ignored real flicks', () => {
		expect(pageStep(-30, 0, 400, limits)).toBe(0);
	});

	it('does not count a flick that moved less than the axis lock', () => {
		expect(pageStep(-4, -2, 400, limits)).toBe(0);
	});

	it('goes backwards on a rightward gesture', () => {
		expect(pageStep(120, 0, 400, limits)).toBe(-1);
	});
});

describe('settleSpec', () => {
	const limits = { min: 190, max: 340, v0Min: -3, v0Max: 6 };

	it('has nothing to settle when it is already there', () => {
		expect(settleSpec(0.4, 400, 0, limits)).toBeNull();
	});

	it('gives a whole page the full duration', () => {
		expect(settleSpec(400, 400, 0, limits)?.duration).toBe(340);
	});

	it('gives a short correction less time, but never under the floor', () => {
		const short = settleSpec(10, 400, 0, limits);
		expect(short?.duration).toBe(190);
	});

	it('carries the gesture velocity as a positive v0 when travelling toward the slot', () => {
		const spec = settleSpec(400, 400, 2, limits);
		expect(spec?.v0).toBeGreaterThan(0);
	});

	it('caps v0 where a critically damped spring would start to overshoot', () => {
		expect(settleSpec(400, 400, 999, limits)?.v0).toBe(6);
		expect(settleSpec(400, 400, -999, limits)?.v0).toBe(-3);
	});
});

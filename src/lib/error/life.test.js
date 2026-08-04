import { describe, expect, it } from 'vitest';
import {
	drawShape,
	getShape,
	gridsEqual,
	parseShape,
	population,
	SHAPE_NAMES,
	seedField,
	step,
	transformShape
} from './life.js';

/** `['.O.', 'OOO']` laid into a fresh grid at (ox, oy). */
function grid(cols, rows, art = [], ox = 0, oy = 0) {
	const g = new Uint8Array(cols * rows);
	return drawShape(g, cols, rows, parseShape(art), ox, oy);
}

/** The live cells, sorted, so two grids can be compared by shape. */
function cellsOf(g, cols) {
	const out = [];
	for (let i = 0; i < g.length; i++) if (g[i]) out.push([i % cols, Math.floor(i / cols)]);
	return out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/**
 * `times` generations on from `g`, leaving `g` alone — the buffers rotate, so
 * without the copy an even number of steps writes the result back into the
 * caller's own array and every "compare against where it started" assertion
 * quietly compares a grid to itself.
 */
function advance(g, cols, rows, times = 1) {
	let cur = Uint8Array.from(g);
	let next = new Uint8Array(cur.length);
	for (let i = 0; i < times; i++) {
		step(cur, next, cols, rows);
		[cur, next] = [next, cur];
	}
	return cur;
}

describe('step', () => {
	it('holds a block still', () => {
		const cols = 8;
		const rows = 8;
		const block = grid(cols, rows, ['OO', 'OO'], 3, 3);
		expect(cellsOf(advance(block, cols, rows), cols)).toEqual(cellsOf(block, cols));
	});

	it('oscillates a blinker with period two', () => {
		const cols = 9;
		const rows = 9;
		const start = grid(cols, rows, ['OOO'], 3, 4);

		const one = advance(start, cols, rows, 1);
		expect(cellsOf(one, cols)).toEqual([
			[4, 3],
			[4, 4],
			[4, 5]
		]);
		expect(cellsOf(advance(start, cols, rows, 2), cols)).toEqual(cellsOf(start, cols));
	});

	it('walks a glider one cell diagonally every four generations', () => {
		const cols = 20;
		const rows = 20;
		const start = grid(cols, rows, getShapeArt('glider'), 4, 4);
		const before = cellsOf(start, cols);
		const moved = cellsOf(advance(start, cols, rows, 4), cols);

		expect(moved.length).toBe(before.length);
		// The glider is the same five cells, translated. Which diagonal it takes
		// is the shape's business; that it translates rigidly is the invariant.
		const dx = moved[0][0] - before[0][0];
		const dy = moved[0][1] - before[0][1];
		expect(Math.abs(dx)).toBe(1);
		expect(Math.abs(dy)).toBe(1);
		expect(moved).toEqual(before.map(([x, y]) => [x + dx, y + dy]));
	});

	it('wraps at the edges instead of dying there', () => {
		// A vertical blinker straddling the top edge: without the wrap the top
		// cell has no neighbours above and the whole thing dies out.
		const cols = 7;
		const rows = 7;
		const g = new Uint8Array(cols * rows);
		g[0 * cols + 3] = 1;
		g[1 * cols + 3] = 1;
		g[(rows - 1) * cols + 3] = 1;

		const after = advance(g, cols, rows, 1);
		expect(population(after)).toBe(3);
		expect(cellsOf(after, cols)).toEqual([
			[2, 0],
			[3, 0],
			[4, 0]
		]);
	});
});

describe('shapes', () => {
	it('parses every shape in the library to a non-empty pattern', () => {
		for (const name of SHAPE_NAMES) {
			const shape = getShape(name);
			expect(shape.cells.length, name).toBeGreaterThan(0);
			for (const [x, y] of shape.cells) {
				expect(x, name).toBeLessThan(shape.w);
				expect(y, name).toBeLessThan(shape.h);
			}
		}
	});

	it('keeps the glider gun a gun — it still emits after a full period', () => {
		// The gun's period is 30. Left alone on a large enough torus it should
		// gain exactly one glider's worth of cells per period, which is the only
		// property that matters: if a transcription error broke it, it would
		// collapse into debris instead.
		const cols = 90;
		const rows = 60;
		const g = new Uint8Array(cols * rows);
		drawShape(g, cols, rows, getShape('gun'), 2, 2);
		const start = population(g);

		const after = advance(g, cols, rows, 30);
		expect(population(after)).toBe(start + 5);
	});

	it('rotates four times back to where it started', () => {
		const shape = getShape('glider');
		const round = transformShape(transformShape(shape, 2), 2);
		expect(cellsOfShape(round)).toEqual(cellsOfShape(shape));
	});

	it('swaps width and height on a quarter turn', () => {
		const shape = getShape('pentadecathlon');
		const turned = transformShape(shape, 1);
		expect(turned.w).toBe(shape.h);
		expect(turned.h).toBe(shape.w);
		expect(turned.cells.length).toBe(shape.cells.length);
	});

	it('mirrors without losing or duplicating cells', () => {
		const shape = getShape('lwss');
		const mirrored = transformShape(shape, 0, true);
		expect(new Set(mirrored.cells.map(String)).size).toBe(shape.cells.length);
	});
});

describe('seedField', () => {
	/** Deterministic, and it walks the whole [0, 1) range so placement actually
	    moves around the grid rather than piling up in one corner. */
	function sequence(seed = 1) {
		let s = seed;
		return () => {
			s = (s * 1664525 + 1013904223) % 4294967296;
			return s / 4294967296;
		};
	}

	it('fills a grid with shapes', () => {
		const cols = 120;
		const rows = 75;
		const g = new Uint8Array(cols * rows);
		seedField(g, cols, rows, { random: sequence() });

		const live = population(g);
		expect(live).toBeGreaterThan(100);
		// Sparse on purpose: this is a background, and a field seeded near
		// saturation burns down to noise in a dozen generations.
		expect(live).toBeLessThan(cols * rows * 0.1);
	});

	it('leaves reserved boxes untouched', () => {
		const cols = 120;
		const rows = 75;
		const g = new Uint8Array(cols * rows);
		const box = { x: 30, y: 20, w: 60, h: 30 };
		seedField(g, cols, rows, { reserved: [box], random: sequence(7) });

		for (let y = box.y; y < box.y + box.h; y++) {
			for (let x = box.x; x < box.x + box.w; x++) {
				expect(g[y * cols + x], `(${x}, ${y})`).toBe(0);
			}
		}
	});

	it('clears whatever was in the grid before', () => {
		const cols = 60;
		const rows = 40;
		const g = new Uint8Array(cols * rows).fill(1);
		seedField(g, cols, rows, { random: sequence(3) });
		expect(population(g)).toBeLessThan(cols * rows);
	});

	it('composes a different field on every call', () => {
		const cols = 100;
		const rows = 60;
		const a = new Uint8Array(cols * rows);
		const b = new Uint8Array(cols * rows);
		seedField(a, cols, rows, { random: sequence(1) });
		seedField(b, cols, rows, { random: sequence(2) });
		expect(gridsEqual(a, b)).toBe(false);
	});

	it('scales its shape count with the area', () => {
		const small = new Uint8Array(60 * 40);
		const large = new Uint8Array(200 * 120);
		seedField(small, 60, 40, { random: sequence(5) });
		seedField(large, 200, 120, { random: sequence(5) });
		expect(population(large)).toBeGreaterThan(population(small));
	});

	it('survives a grid too small to place much in', () => {
		const g = new Uint8Array(10 * 8);
		expect(() => seedField(g, 10, 8, { random: sequence() })).not.toThrow();
	});
});

function cellsOfShape(shape) {
	return shape.cells.map(([x, y]) => `${x},${y}`).sort();
}

function getShapeArt(name) {
	const shape = getShape(name);
	const art = Array.from({ length: shape.h }, () => Array(shape.w).fill('.'));
	for (const [x, y] of shape.cells) art[y][x] = 'O';
	return art.map((row) => row.join(''));
}

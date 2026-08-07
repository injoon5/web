/**
 * Conway's Game of Life, as the error pages' background.
 *
 * A flat `Uint8Array` of `cols * rows`, on a torus — wrapping is not a shortcut
 * around edge handling but what keeps the field alive: on a bounded grid every
 * spaceship walks off the side and the composition bleeds out from the rim.
 *
 * Nothing here touches the DOM; the glyph stamp needs a canvas and lives in
 * `glyph.js`.
 */

/**
 * One generation (B3/S23), written into `next`. Row offsets are hoisted and the
 * column wrap is a conditional rather than a `%` — this runs over every cell of
 * a full-viewport grid several times a second.
 */
export function step(cur, next, cols, rows) {
	for (let y = 0; y < rows; y++) {
		const up = (y === 0 ? rows - 1 : y - 1) * cols;
		const mid = y * cols;
		const down = (y === rows - 1 ? 0 : y + 1) * cols;

		for (let x = 0; x < cols; x++) {
			const left = x === 0 ? cols - 1 : x - 1;
			const right = x === cols - 1 ? 0 : x + 1;

			const n =
				cur[up + left] +
				cur[up + x] +
				cur[up + right] +
				cur[mid + left] +
				cur[mid + right] +
				cur[down + left] +
				cur[down + x] +
				cur[down + right];

			next[mid + x] = n === 3 || (n === 2 && cur[mid + x]) ? 1 : 0;
		}
	}
	return next;
}

/** How many cells are alive. Drives the stagnation check and the reseed. */
export function population(grid) {
	let n = 0;
	for (let i = 0; i < grid.length; i++) n += grid[i];
	return n;
}

export function gridsEqual(a, b) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

/**
 * The shape library, as ASCII so a pattern can be read and corrected by looking
 * at it. `O` is alive. Random noise settles into still lifes within ~150
 * generations and then sits there, which is why these are seeded deliberately.
 */
const SHAPES = {
	// Travels diagonally forever. The workhorse — most of the motion on screen
	// is gliders crossing it.
	glider: ['.O.', '..O', 'OOO'],

	// The three orthogonal spaceships, in ascending size. They fly in straight
	// lines, which reads very differently from the gliders' diagonals.
	lwss: ['.O..O', 'O....', 'O...O', 'OOOO.'],
	mwss: ['...O..', '.O...O', 'O.....', 'O....O', 'OOOOO.'],
	hwss: ['....O..', '.O....O', 'O......', 'O.....O', 'OOOOOO.'],

	// Period-3, thirteen cells square, and symmetric on both axes — the one
	// shape here that looks designed rather than grown.
	pulsar: [
		'..OOO...OOO..',
		'.............',
		'O....O.O....O',
		'O....O.O....O',
		'O....O.O....O',
		'..OOO...OOO..',
		'.............',
		'..OOO...OOO..',
		'O....O.O....O',
		'O....O.O....O',
		'O....O.O....O',
		'.............',
		'..OOO...OOO..'
	],

	// Period-15. Long, thin, and slow enough to notice against the pulsar.
	pentadecathlon: ['..O....O..', 'OO.OOOO.OO', '..O....O..'],

	// Gosper's glider gun: the reason the field never dies. It emits a glider
	// every thirty generations, indefinitely, so however thoroughly the rest of
	// the composition burns itself out something is always crossing the screen.
	gun: [
		'........................O...........',
		'......................O.O...........',
		'............OO......OO............OO',
		'...........O...O....OO............OO',
		'OO........O.....O...OO..............',
		'OO........O...O.OO....O.O...........',
		'..........O.....O.......O...........',
		'...........O...O....................',
		'............OO......................'
	],

	// Methuselahs — seven cells that spend five thousand generations turning
	// into a mess. These are the chaos, and they are placed sparingly.
	acorn: ['.O.....', '...O...', 'OO..OOO'],
	rPentomino: ['.OO', 'OO.', '.O.'],
	diehard: ['......O.', 'OO......', '.O...OOO'],

	// Small oscillators. Punctuation: they hold a rhythm in the quiet parts of
	// the field without spreading.
	blinker: ['OOO'],
	toad: ['.OOO', 'OOO.'],
	beacon: ['OO..', 'OO..', '..OO', '..OO'],

	// Still lifes. These never move at all, which is the point — a field where
	// everything moves has no scale to read the movement against.
	block: ['OO', 'OO'],
	beehive: ['.OO.', 'O..O', '.OO.'],
	loaf: ['.OO.', 'O..O', '.O.O', '..O.'],
	boat: ['OO.', 'O.O', '.O.']
};

/** `['.O.', 'OOO']` → `{ w, h, cells: [[x, y], ...] }`. */
export function parseShape(art) {
	const h = art.length;
	const w = Math.max(...art.map((row) => row.length));
	const cells = [];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < art[y].length; x++) {
			if (art[y][x] === 'O') cells.push([x, y]);
		}
	}
	return { w, h, cells };
}

/**
 * Quarter turns and a mirror, so one glider definition covers all four
 * diagonals and one spaceship flies both ways. `turns` is clockwise.
 */
export function transformShape(shape, turns = 0, mirror = false) {
	let { w, h, cells } = shape;

	for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
		cells = cells.map(([x, y]) => [h - 1 - y, x]);
		[w, h] = [h, w];
	}
	if (mirror) cells = cells.map(([x, y]) => [w - 1 - x, y]);

	return { w, h, cells };
}

export function getShape(name) {
	return parseShape(SHAPES[name]);
}

export const SHAPE_NAMES = Object.keys(SHAPES);

/** Draw a shape into the grid at (ox, oy), wrapping like the simulation does. */
export function drawShape(grid, cols, rows, shape, ox, oy) {
	for (const [x, y] of shape.cells) {
		const gx = (((ox + x) % cols) + cols) % cols;
		const gy = (((oy + y) % rows) + rows) % rows;
		grid[gy * cols + gx] = 1;
	}
	return grid;
}

function overlaps(a, b, margin) {
	return (
		a.x - margin < b.x + b.w &&
		a.x + a.w + margin > b.x &&
		a.y - margin < b.y + b.h &&
		a.y + a.h + margin > b.y
	);
}

/**
 * The composition as a recipe: counts per 10,000 cells, so they scale with the
 * grid. Order matters — placement is first-come, so the big structural pieces
 * claim their room before the small ones fill in around them.
 */
const RECIPE = [
	{ name: 'gun', per10k: 0.55, min: 1, max: 3, rotate: true },
	{ name: 'pulsar', per10k: 0.5, min: 1, max: 4 },
	{ name: 'pentadecathlon', per10k: 0.45, min: 1, max: 4, rotate: true },
	{ name: 'acorn', per10k: 0.35, min: 0, max: 2, rotate: true },
	{ name: 'rPentomino', per10k: 0.3, min: 0, max: 2, rotate: true },
	{ name: 'diehard', per10k: 0.25, min: 0, max: 2, rotate: true },
	{ name: 'hwss', per10k: 0.5, min: 0, max: 3, rotate: true },
	{ name: 'mwss', per10k: 0.5, min: 0, max: 3, rotate: true },
	{ name: 'lwss', per10k: 0.8, min: 1, max: 5, rotate: true },
	{ name: 'glider', per10k: 2.4, min: 3, max: 22, rotate: true },
	{ name: 'beacon', per10k: 0.5, min: 0, max: 4 },
	{ name: 'toad', per10k: 0.6, min: 0, max: 5, rotate: true },
	{ name: 'blinker', per10k: 0.9, min: 1, max: 7, rotate: true },
	{ name: 'loaf', per10k: 0.6, min: 0, max: 5, rotate: true },
	{ name: 'beehive', per10k: 0.6, min: 0, max: 5, rotate: true },
	{ name: 'boat', per10k: 0.5, min: 0, max: 4, rotate: true },
	{ name: 'block', per10k: 0.8, min: 0, max: 6 }
];

/**
 * Lay a fresh composition into `grid`. `reserved` is boxes nothing may be placed
 * inside — the caller passes the numeral's bounding box, so the stamp reads clean
 * at generation zero. Placement is rejection sampling with a margin: shapes that
 * start touching interact on the first step.
 *
 * `random` is injectable so tests get a deterministic field.
 */
export function seedField(
	grid,
	cols,
	rows,
	{ reserved = [], density = 1, random = Math.random } = {}
) {
	grid.fill(0);

	const placed = reserved.map((box) => ({ ...box }));
	const area = (cols * rows) / 10000;

	for (const entry of RECIPE) {
		const wanted = Math.round(
			Math.min(entry.max, Math.max(entry.min, entry.per10k * area * density))
		);

		for (let i = 0; i < wanted; i++) {
			const turns = entry.rotate ? Math.floor(random() * 4) : 0;
			const shape = transformShape(getShape(entry.name), turns, entry.rotate && random() < 0.5);

			// A shape that cannot find a home in a handful of tries is one the
			// grid has no room for; giving up beats spinning on a full field.
			for (let attempt = 0; attempt < 24; attempt++) {
				const x = Math.floor(random() * Math.max(1, cols - shape.w));
				const y = Math.floor(random() * Math.max(1, rows - shape.h));
				const box = { x, y, w: shape.w, h: shape.h };

				if (placed.some((other) => overlaps(box, other, 2))) continue;

				drawShape(grid, cols, rows, shape, x, y);
				placed.push(box);
				break;
			}
		}
	}

	return grid;
}

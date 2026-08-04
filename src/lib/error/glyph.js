/**
 * The status code, rendered into cells.
 *
 * The number is not a bitmap font. It is the site's own typeface, drawn into an
 * offscreen canvas the size of the Life grid and thresholded — so `404` on the
 * error page is the same `404` the heading would set, just quantised to the
 * cell grid and then handed to the simulation to take apart.
 *
 * Two details make it read as a numeral rather than a smear:
 *
 * - **It is stroked, not filled.** A filled glyph is a solid slab, and a solid
 *   slab of cells is the one thing Life kills instantly — every interior cell
 *   has eight neighbours and dies of overpopulation on step one, leaving a
 *   hollow outline anyway. Stroking asks for that outline directly, at a width
 *   we choose, and an outline is also a far more interesting thing to evolve:
 *   long thin lines throw off symmetric debris for hundreds of generations
 *   where a slab just craters.
 * - **It is supersampled.** Drawing at grid resolution means a 40px-tall font,
 *   where hinting and antialiasing turn the curve of a `0` into mush. The glyph
 *   is drawn at `S` times the grid and box-filtered down, so each cell is the
 *   average coverage of its own square and the letterforms survive.
 */

/** Widest offscreen canvas we will ask for, in device pixels. */
const MAX_RASTER = 2400;

/**
 * Make sure the face is actually available before measuring against it.
 *
 * The site's typeface is served as a dynamic subset, so the digits may not have
 * arrived when the error page mounts. Measuring too early sizes the number
 * against the fallback and it lands at the wrong scale — visibly wrong, since
 * the whole point is that it is set in the site's font.
 */
export async function waitForFont(font, text, timeout = 500) {
	if (typeof document === 'undefined' || !document.fonts) return;
	try {
		// Raced against a deadline, not simply awaited: a font that never resolves
		// would leave the page with no background at all, and a numeral set in the
		// fallback face is a far smaller loss than an empty viewport.
		await Promise.race([
			(async () => {
				await document.fonts.load(font, text);
				await document.fonts.ready;
			})(),
			new Promise((resolve) => setTimeout(resolve, timeout))
		]);
	} catch {
		// A font that refuses to load is not a reason to skip the background.
	}
}

/**
 * Rasterise `text` into a `cols * rows` mask.
 *
 * Returns the mask and the bounding box of what was drawn, in cells — the
 * caller reserves that box so the seeded shapes keep clear of it. `null` comes
 * back when there is no 2D context or the text rasterised to nothing, and the
 * caller is expected to carry on without a stamp.
 */
export function stampText(
	text,
	cols,
	rows,
	{
		font = 'sans-serif',
		weight = 600,
		/** Glyph height in cells, before the width cap applies. */
		height = 40,
		/** Never let the number grow wider than this many cells. */
		maxWidth = cols,
		/** Vertical centre of the stamp, in cells. */
		centerY = rows / 2,
		/** Extra space between glyphs, in cells. Loose tracking keeps the
		    outlines from merging into one blob at this resolution. */
		tracking = 0,
		/** Stroke width in cells. Below ~1.5 the outline breaks up under the
		    threshold; above ~2.5 it stops reading as a line. */
		strokeWidth = 1.8,
		outline = true,
		supersample = 4
	} = {}
) {
	if (typeof document === 'undefined') return null;

	const s = Math.max(1, Math.min(supersample, Math.floor(MAX_RASTER / Math.max(1, cols))));
	const canvas = document.createElement('canvas');
	canvas.width = cols * s;
	canvas.height = rows * s;

	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return null;

	// letterSpacing has to be re-applied after every `font` write: some engines
	// reset it as part of the shorthand parse, and silently losing the tracking
	// is exactly the failure that makes the glyphs run together.
	const setFont = (px) => {
		ctx.font = `${weight} ${px}px ${font}`;
		try {
			ctx.letterSpacing = `${tracking * s}px`;
		} catch {
			// Pre-2023 Safari. The tracking is a refinement, not a requirement.
		}
	};

	// Measure once at a reference size and scale, rather than binary-searching
	// the font size: text metrics are linear in it.
	const REF = 200;
	setFont(REF);
	const refMetrics = ctx.measureText(text);
	const refHeight =
		(refMetrics.actualBoundingBoxAscent || 0) + (refMetrics.actualBoundingBoxDescent || 0) ||
		REF * 0.72;
	const refWidth = refMetrics.width || REF * 0.6 * text.length;

	const size = Math.max(
		1,
		Math.min(((height * s) / refHeight) * REF, ((maxWidth * s) / refWidth) * REF)
	);
	setFont(size);

	const metrics = ctx.measureText(text);
	const ascent = metrics.actualBoundingBoxAscent || size * 0.72;
	const descent = metrics.actualBoundingBoxDescent || 0;
	// Chrome counts the trailing letter-space in `width`, which pushes the
	// number off-centre by half a cell of tracking. Take it back.
	const drawnWidth = Math.max(0, metrics.width - tracking * s);

	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.lineWidth = Math.max(1, strokeWidth * s);
	ctx.strokeStyle = '#000';
	ctx.fillStyle = '#000';

	const x = (canvas.width - drawnWidth) / 2;
	const y = centerY * s - (ascent + descent) / 2 + ascent;

	if (outline) ctx.strokeText(text, x, y);
	else ctx.fillText(text, x, y);

	const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const mask = new Uint8Array(cols * rows);
	// Half coverage of the cell. Lower fattens the strokes and closes the
	// counters of an `8` or a `0`; higher shatters them into dashes.
	const threshold = 0.45 * s * s * 255;

	let minX = cols;
	let minY = rows;
	let maxX = -1;
	let maxY = -1;

	for (let gy = 0; gy < rows; gy++) {
		for (let gx = 0; gx < cols; gx++) {
			let sum = 0;
			for (let sy = 0; sy < s; sy++) {
				// Alpha channel of the first subpixel in this row of the block.
				let i = ((gy * s + sy) * canvas.width + gx * s) * 4 + 3;
				for (let sx = 0; sx < s; sx++, i += 4) sum += data[i];
			}
			if (sum < threshold) continue;

			mask[gy * cols + gx] = 1;
			if (gx < minX) minX = gx;
			if (gx > maxX) maxX = gx;
			if (gy < minY) minY = gy;
			if (gy > maxY) maxY = gy;
		}
	}

	if (maxX < 0) return null;

	return {
		mask,
		box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
	};
}

/**
 * Every number the error pages' Life field is drawn with.
 *
 * These are the shipped values, read by `LifeField.svelte` and written by
 * nothing in production. On preview deployments `ErrorDials.svelte` binds a
 * DialKit panel to this same object, so the sliders move the real field —
 * which is the only honest way to pick a cell size or a step rate, because
 * both of them are about how the whole viewport feels at a glance rather than
 * about any value you could reason your way to.
 *
 * Whatever settles gets copied back into `LIFE_DEFAULTS` by hand. Nothing
 * persists.
 */

export const LIFE_DEFAULTS = {
	/**
	 * Cell pitch in CSS px, from `sm` up and below it. Two values because the
	 * grid has to be fine enough for the status number to keep its letterforms:
	 * a phone at the desktop pitch gets about thirty cells across the numeral,
	 * which is not enough to hold the curve of a zero.
	 */
	cell: 13,
	cellSm: 7,
	/** Space between cells, in px. The grid should read as a grid. */
	gap: 1,
	/** Corner radius per cell, in px. Zero is a square, and squares are honest. */
	radius: 0,

	/**
	 * Milliseconds per generation. Around 110 the field reads as alive without
	 * flickering; much faster and the eye gives up trying to follow a glider,
	 * much slower and the page feels like it is buffering.
	 */
	stepMs: 110,
	/**
	 * How long the seeded composition holds before the first generation runs.
	 * The number is legible for exactly as long as this, so it is the difference
	 * between "the 404 dissolved" and "there was some noise on the page".
	 */
	holdMs: 1800,
	/** Scales every shape count in the recipe. */
	density: 1,
	/**
	 * Generations before the field is torn down and reseeded. Chaos left alone
	 * eventually fills the torus with even debris, which is texture rather than
	 * composition — this is what keeps the shapes coming back.
	 */
	cycle: 900,

	/** Glyph height as a fraction of the viewport's height. */
	stampHeight: 0.36,
	/** ...capped at this fraction of its width, which is what binds on a phone. */
	stampWidth: 0.82,
	/** Vertical centre of the numeral, as a fraction of viewport height. High
	    enough to leave the lower third to the type. */
	stampCenter: 0.32,
	/** Extra space between glyphs, in cells. Two outlines a cell apart merge
	    into one shape under the threshold, and then it is not a number. */
	stampTracking: 1.4,
	/** Outline weight, in cells. */
	stampStroke: 1.8,
	/** Outline rather than a solid slab — see the note in `glyph.js`. */
	stampOutline: true,

	/** Alpha of the whole field. The cell colour already carries most of the
	    restraint; this is the last bit of headroom. */
	opacity: 1
};

export const lifeSettings = $state({ ...LIFE_DEFAULTS });

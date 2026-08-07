/**
 * Every number the error pages' Life field is drawn with. Production reads them
 * and writes nothing; on preview, `ErrorDials.svelte` binds a DialKit panel to
 * this same object. Whatever settles is copied back by hand.
 */

export const LIFE_DEFAULTS = {
	/**
	 * Cell pitch in CSS px, above and below `sm`. Two values because the grid has
	 * to stay fine enough for the status number to keep its letterforms.
	 */
	cell: 13,
	cellSm: 7,
	/** Space between cells, in px. The grid should read as a grid. */
	gap: 1,
	/** Corner radius per cell, in px. */
	radius: 0,

	/** Milliseconds per generation. */
	stepMs: 110,
	/**
	 * How long the seeded composition holds before the first generation runs. Also
	 * the page's clock: the field hands the numeral to the type at the end of the
	 * hold (see `LifeField`'s `onrelease`).
	 */
	holdMs: 4000,
	/** Scales every shape count in the recipe. */
	density: 1,
	/** Generations before the field is reseeded, so shapes keep coming back. */
	cycle: 900,

	/** Glyph height as a fraction of the viewport's height. */
	stampHeight: 0.36,
	/** ...capped at this fraction of its width, which is what binds on a phone. */
	stampWidth: 0.82,
	/** Vertical centre of the numeral, as a fraction of viewport height. */
	stampCenter: 0.32,
	/** Extra space between glyphs, in cells. Two outlines a cell apart merge
	    into one shape under the threshold, and then it is not a number. */
	stampTracking: 1.4,
	/** Outline weight, in cells. */
	stampStroke: 1.8,
	/** Outline rather than a solid slab — see the note in `glyph.js`. */
	stampOutline: true,

	/** Alpha of the whole field. */
	opacity: 1
};

export const lifeSettings = $state({ ...LIFE_DEFAULTS });

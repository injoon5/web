/**
 * Every number the /health charts are drawn with, in one place.
 *
 * These are the shipped values — the chart reads them and nothing writes them
 * in production. On preview deployments `HealthDials.svelte` binds a DialKit
 * panel to this same object, so the sliders move the real charts rather than a
 * mock, and whatever settles can be copied straight back into `CHART_DEFAULTS`.
 *
 * A `$state` object costs one proxy in the builds that never open the panel,
 * which is cheaper than threading a dozen props through two components.
 */

export const CHART_DEFAULTS = {
	/** `area` draws the wash under the line; `line` is the stroke on its own. */
	variant: 'area',
	/** `smooth` reads better on sparse windows, `linear` is honest on dense ones. */
	curve: 'linear',
	strokeWidth: 2.25,
	/**
	 * Alpha at the top of the wash, where it meets the line. From there it eases
	 * to nothing along `WASH_RAMP`.
	 */
	washAlpha: 0.24,
	/**
	 * Plot height in px, from `sm` up. The section reserves this before hydration.
	 *
	 * Tall, because there are only four of these: at 120 the sections left a band
	 * of empty column under them on anything wider than a phone, and a sparkline
	 * with more vertical range is a sparkline you can actually read a shape off.
	 */
	height: 176,
	/**
	 * And shorter below `sm`, where the four sections stack into one column and
	 * the full height turned the page into five thousand pixels of scrolling.
	 */
	heightSm: 140,
	/** Left gutter the y axis labels are right-aligned into. */
	gutter: 34,
	/** Vertical breathing room, so a peak never touches the top of the box. */
	padY: 8,
	/** Roughly how many y labels d3 aims for. Two is a floor and a ceiling. */
	tickCount: 2,
	/** Headroom above the highest reading, as a fraction of the data range. */
	headroom: 0.12,
	/** Radius of the dot marking the scrubbed day. */
	markerRadius: 3.5
};

export const CHART_VARIANTS = ['area', 'line'];
export const CHART_CURVES = ['linear', 'smooth'];

/**
 * How the wash falls away under the line, as `[offset, share of washAlpha]`.
 *
 * Two stops and a linear ramp did not read as a fade — it dropped off fast near
 * the line, then held a flat film all the way down and stopped dead at the
 * baseline, which is a visible edge rather than a gradient. This is an ease-out:
 * most of the alpha is spent in the top third, and the deltas shrink the whole
 * way down, so the last of it dissolves into the page instead of ending.
 *
 * The final stop is a true zero, and every stop is mixed from the accent rather
 * than toward the keyword `transparent` — `transparent` is transparent *black*,
 * so interpolating to it drags the tail through grey and leaves exactly the
 * muddy halo this ramp exists to avoid. Mixing in oklab at alpha 0 keeps the
 * hue and takes the alpha to nothing.
 *
 * The gradient uses `objectBoundingBox`, so offset 100% is the bottom of the
 * area shape — the baseline — not the bottom of the chart box.
 */
export const WASH_RAMP = [
	[0, 1],
	[0.22, 0.68],
	[0.42, 0.42],
	[0.62, 0.22],
	[0.8, 0.08],
	[1, 0]
];

/**
 * Colour is the one thing here the charts do _not_ read from this object.
 *
 * Every chart colour is already a CSS custom property, which is what carries
 * the site's dark mode — so the panel tunes them by overriding those properties
 * on `:root` rather than by threading values through the components. Nothing in
 * the shipped path changes, and the light/dark pair in `app.css` stays the
 * single source of truth.
 *
 * These are the light-mode values from `app.css`, and they are compared against
 * before an override is written: a control still sitting on its default leaves
 * the stylesheet alone, so opening the panel in dark mode doesn't snap the page
 * to light colours.
 */
export const CHART_COLORS = {
	accent: '#f97316', // orange-500
	axis: '#a3a3a3', // neutral-400
	track: '#e5e5e5', // neutral-200
	excellent: '#10b750',
	good: '#84cc16', // lime-500
	fair: '#f59e0b', // amber-500
	light: '#fb7185' // rose-400
};

/** Which custom property each tunable colour drives. */
export const COLOR_VARS = {
	accent: '--chart-accent',
	axis: '--chart-muted',
	track: '--chart-track',
	excellent: '--score-excellent',
	good: '--score-good',
	fair: '--score-fair',
	light: '--score-light'
};

export const chartSettings = $state({ ...CHART_DEFAULTS });

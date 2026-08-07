/**
 * Every number the /health charts are drawn with. Production reads them and
 * writes nothing; on preview, `HealthDials.svelte` binds a DialKit panel to this
 * same object. Whatever settles is copied back into `CHART_DEFAULTS` by hand.
 */

export const CHART_DEFAULTS = {
	/** `area` draws the wash under the line; `line` is the stroke on its own. */
	variant: 'area',
	/** `smooth` reads better on sparse windows, `linear` is honest on dense ones. */
	curve: 'linear',
	strokeWidth: 1.5,
	/** Alpha where the wash meets the line; it eases to nothing along `WASH_RAMP`. */
	washAlpha: 0.24,
	/** Plot height in px from `sm` up. The section reserves this before hydration. */
	height: 176,
	/** Shorter below `sm`, where the four sections stack into one column. */
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
 * How the wash falls away under the line, as `[offset, share of washAlpha]`. An
 * ease-out, not a linear ramp, which held a flat film and stopped dead at the
 * baseline.
 *
 * Every stop is mixed from the accent, never toward the keyword `transparent` —
 * that is transparent *black*, so interpolating to it drags the tail through
 * grey. Offsets are `objectBoundingBox`, so 100% is the baseline.
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
 * Colours are the one thing the charts do NOT read from this object — they are
 * CSS custom properties, which is what carries dark mode, so the panel overrides
 * those on `:root` instead. These are the light values from `app.css`, compared
 * against before writing: a control on its default writes nothing, so opening
 * the panel in dark mode does not snap the page to light colours.
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

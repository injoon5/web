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
	strokeWidth: 3,
	/**
	 * Plot height in px. The section reserves this before hydration.
	 *
	 * Tall, because there are only four of these: at 120 the sections left a band
	 * of empty column under them on anything wider than a phone, and a sparkline
	 * with more vertical range is a sparkline you can actually read a shape off.
	 */
	height: 176,
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
	excellent: '#10b981', // emerald-500
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

/** Top-of-wash alpha, mirroring `transparent 76%` in `app.css`. */
export const WASH_OPACITY = 0.24;

export const chartSettings = $state({ ...CHART_DEFAULTS });

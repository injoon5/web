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
	strokeWidth: 2.5,
	/** Plot height in px. The section reserves this before hydration. */
	height: 120,
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

export const chartSettings = $state({ ...CHART_DEFAULTS });

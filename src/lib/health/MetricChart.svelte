<script>
	import {
		Area,
		Axis,
		Chart,
		Highlight,
		LinearGradient,
		Points,
		Spline,
		Svg,
		Text
	} from 'layerchart';
	import { scaleLinear } from 'd3-scale';
	import { curveLinear, curveMonotoneX } from 'd3-shape';
	import { WASH_RAMP, chartSettings } from '$lib/health/chart-settings.svelte.js';
	import { formatCompact, pickAxisTicks, valueDomain, zeroFilled } from '$lib/health/metrics.js';

	/**
	 * A sparkline, not a graph: no gridlines, no tooltip box, and an axis that is
	 * only ever text.
	 *
	 * Scrubbing is reported up rather than handled here, and the marker is drawn
	 * from the `active` index handed back down — so every chart on the page marks
	 * the same day, whichever one the pointer is over.
	 *
	 * Every dimension comes from `chartSettings`, which is a plain object of
	 * shipped defaults everywhere except preview deployments — see
	 * `chart-settings.svelte.js`.
	 */
	let { values, label, decimals = 0, delay = 0, active = null, onscrub } = $props();

	/**
	 * Room for the axis labels, in the chart's own padding rather than a wrapper:
	 * the plot box shrinks to fit them, so the line never runs under the text.
	 * Top and bottom leave a label centred on the edge of the plot somewhere to
	 * render — the labels sit at the extremes of the domain by design.
	 */
	const padding = $derived({
		top: chartSettings.padY,
		bottom: chartSettings.padY,
		left: chartSettings.gutter
	});

	// A day that reported nothing is a day of zero, up to the newest reading;
	// past that the metric has nothing to say yet and the line stops.
	const plotted = $derived(zeroFilled(values));

	// Points span the whole window even where the line does not, so every chart
	// on the page shares one x domain — index 12 is the same day, and the same
	// pixel, on all of them.
	const points = $derived(
		values.map((_, i) => ({ i, value: i < plotted.length ? plotted[i] : null }))
	);
	const defined = (d) => d.value !== null;

	const domain = $derived(valueDomain(plotted, chartSettings.headroom));
	const curve = $derived(chartSettings.curve === 'smooth' ? curveMonotoneX : curveLinear);

	/**
	 * Two or three round numbers, and no line anywhere near them.
	 *
	 * The headline above the chart already carries the exact value for the day
	 * under the pointer, so the axis only has to say what order of magnitude the
	 * line is drawn at. Asking d3 for round numbers inside the domain, rather
	 * than labelling the extremes, is what keeps `12k` from reading `11,842`.
	 */
	const ticks = $derived.by(() => {
		const nice = scaleLinear().domain(domain).ticks(chartSettings.tickCount);
		return pickAxisTicks(nice.length ? nice : [domain[1]], {
			domain,
			count: chartSettings.tickCount,
			// The shorter of the two heights, so a label pair that clears on desktop
			// can't collide once the same chart is drawn at the phone height.
			plotHeight: Math.min(chartSettings.height, chartSettings.heightSm) - 2 * chartSettings.padY,
			decimals
		});
	});

	/**
	 * The wash, as stops mixed off the accent so it follows the line's colour
	 * through dark mode and through the tuning panel without being told.
	 */
	const washStops = $derived(
		WASH_RAMP.map(([offset, share]) => [
			`${offset * 100}%`,
			`color-mix(in oklab, var(--chart-accent), transparent ${100 - share * chartSettings.washAlpha * 100}%)`
		])
	);

	const marked = $derived(active === null ? null : (points[active] ?? null));

	// A window whose only reading is its first slot has no second point to stroke
	// toward, so it draws as a dot. Every other shape zero-fills into a line.
	const lone = $derived(plotted.length === 1 ? [{ i: 0, value: plotted[0] }] : []);

	/**
	 * Interaction is handled here rather than through a tooltip layer, because on
	 * touch the tooltip layer is re-targeted by hit test on every move: dragging a
	 * finger toward the edge of one chart hands the page's marker to whichever
	 * chart the finger crosses into, and the day jumps to wherever that chart's
	 * line happens to be. Capturing the pointer on the way down pins the whole
	 * drag to the chart it started on.
	 */
	let plot = $state();
	let dragging = $state(false);

	function indexAt(clientX) {
		const rect = plot?.getBoundingClientRect();
		if (!rect) return null;

		const span = rect.width - padding.left;
		if (span <= 0 || points.length === 0) return null;
		if (points.length === 1) return 0;

		const ratio = (clientX - rect.left - padding.left) / span;
		return Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
	}

	function onpointerdown(event) {
		// `pan-y` below still lets a vertical swipe scroll the page away, which
		// arrives as `pointercancel` rather than `pointerup`.
		plot?.setPointerCapture?.(event.pointerId);
		dragging = true;
		onscrub?.(indexAt(event.clientX));
	}

	function onpointermove(event) {
		// A mouse scrubs on hover; a finger only while it is down.
		if (!dragging && event.pointerType === 'touch') return;
		onscrub?.(indexAt(event.clientX));
	}

	function release(event) {
		if (plot?.hasPointerCapture?.(event.pointerId)) plot.releasePointerCapture(event.pointerId);
		dragging = false;
		// A finger has no hover state to fall back to, so lifting it clears the
		// day. A mouse keeps the marker until the pointer actually leaves.
		if (event.pointerType === 'touch') onscrub?.(null);
	}

	function onpointerleave() {
		if (dragging) return;
		onscrub?.(null);
	}
</script>

<!-- `role="img"` with a label, because that is what this is to a screen reader:
     the numbers above it are the accessible version, and scrubbing only ever
     changes which of them is shown. -->
<div
	bind:this={plot}
	class="health-plot h-full w-full"
	role="img"
	aria-label={label}
	{onpointerdown}
	{onpointermove}
	{onpointerleave}
	onpointerup={release}
	onpointercancel={release}
>
	<Chart
		data={points}
		x="i"
		y="value"
		xScale={scaleLinear()}
		xDomain={[0, Math.max(points.length - 1, 1)]}
		yScale={scaleLinear()}
		yDomain={domain}
		{padding}
		tooltipContext={false}
	>
		{#snippet children()}
			<Svg>
				<!-- Text only: no rule under the labels, no gridlines across the plot,
				     not even a tick mark. The numbers are there to size the line, and
				     anything drawn to connect them to it competes with the line.

				     Left-aligned against the outer edge of the gutter rather than
				     right-aligned against the plot, so they start on the same column as
				     the heading, the number and the first date below. Ragged right on
				     two numbers is invisible; four different left edges is not. -->
				<Axis
					placement="left"
					{ticks}
					tickMarks={false}
					stroke="none"
					tickLabelProps={{ textAnchor: 'start', dx: -chartSettings.gutter }}
					classes={{ tickLabel: 'health-axis-label' }}
				>
					{#snippet tickLabel({ props, index })}
						<Text {...props} value={formatCompact(ticks[index], decimals)} />
					{/snippet}
				</Axis>

				<!-- The wash earns its place only as a wash: it fades out downward, so
				     it reads as weight under the line rather than a second shape. The
				     `line` variant drops it entirely. -->
				{#if chartSettings.variant === 'area'}
					<LinearGradient vertical stops={washStops}>
						{#snippet children({ gradient })}
							<Area
								class="health-area"
								style="animation-delay: {delay}ms"
								fill={gradient}
								{curve}
								{defined}
							/>
						{/snippet}
					</LinearGradient>
				{/if}

				<!-- `strokeWidth`, not `stroke-width`: `Path` reads the camelCase one as
				     a real prop and renders it *after* its rest-spread, so a kebab
				     attribute lands in that spread and is then wiped by the prop's own
				     `undefined`. Passed the wrong way it silently never applies. -->
				<Spline
					class="health-line"
					pathLength="1"
					style="animation-delay: {delay}ms"
					stroke="var(--chart-accent)"
					strokeWidth={chartSettings.strokeWidth}
					stroke-linecap="round"
					stroke-linejoin="round"
					fill="none"
					{curve}
					{defined}
				/>

				{#if lone.length}
					<Points
						class="health-dot"
						style="animation-delay: {delay}ms"
						data={lone}
						r={chartSettings.markerRadius}
						fill="var(--chart-accent)"
					/>
				{/if}

				<!-- The rule marks the day on every chart; the dot only appears where
				     that day actually has a reading. -->
				{#if marked}
					<Highlight data={marked} axis="x" motion="none" lines />
					{#if marked.value !== null}
						<Highlight
							data={marked}
							axis="none"
							motion="none"
							points={{ r: chartSettings.markerRadius, fill: 'var(--chart-accent)' }}
						/>
					{/if}
				{/if}
			</Svg>
		{/snippet}
	</Chart>
</div>

<style>
	.health-plot {
		/* A vertical swipe still scrolls the page; a horizontal drag scrubs. */
		touch-action: pan-y;
		-webkit-user-select: none;
		user-select: none;
	}
</style>

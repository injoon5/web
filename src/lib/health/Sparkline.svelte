<script>
	import { WASH_RAMP } from '$lib/health/chart-settings.svelte.js';
	import { valueDomain, zeroFilled } from '$lib/health/metrics.js';

	/**
	 * The /health chart at a fortieth of the size, and with none of its machinery.
	 *
	 * `MetricChart` is the right shape for a page whose whole subject is the
	 * chart — it carries an axis, a shared x domain, pointer capture and a scrub
	 * marker, and it brings layerchart, d3-scale and d3-shape with it. The home
	 * page shows four of these at 36px tall with no axis and nothing to scrub, and
	 * it is the one page on the site that has to paint before anything else does.
	 * Two `<path>` strings built from the same helpers cost nothing at all, so
	 * that is what this is: the same visual language, none of the weight.
	 *
	 * The viewBox is a unit square stretched with `preserveAspectRatio="none"`, so
	 * the geometry is written once in percentages and the box can be any size the
	 * layout hands it. `vector-effect="non-scaling-stroke"` is what keeps the line
	 * 1.5px through that stretch rather than smeared to the box's aspect ratio.
	 */
	let {
		/** Dense daily values, newest last. Trailing nulls are the metric not having synced. */
		values = [],
		/**
		 * Slots in the page's shared window. The line stops where the readings do,
		 * but x is still measured against the whole window — so four sparklines
		 * that end on different days stay on one calendar.
		 */
		span = 0,
		delay = 0,
		/** Alpha at the top of the wash. `CHART_DEFAULTS.washAlpha`, at this size. */
		alpha = 0.24
	} = $props();

	// One gradient per instance rather than one shared def: four ids cost nothing,
	// and a shared one would have to live somewhere neither component owns.
	const uid = $props.id();

	// A day inside the window that reported nothing is a day of zero; past the
	// newest reading the metric has nothing to say and the line stops. Same rule
	// as the full chart, from the same function.
	const plotted = $derived(zeroFilled(values));

	const geometry = $derived.by(() => {
		if (plotted.length === 0) return null;

		const [lo, hi] = valueDomain(plotted);
		const range = hi - lo || 1;
		const last = Math.max(span, plotted.length) - 1;

		const x = (i) => (last <= 0 ? 0 : (i / last) * 100);
		const y = (value) => (1 - (value - lo) / range) * 100;

		let line = '';
		for (let i = 0; i < plotted.length; i++) {
			line += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)} ${y(plotted[i]).toFixed(2)}`;
		}

		const end = plotted.length - 1;
		return {
			line,
			// Down to the baseline, back along it, and `Z` closes up the left edge.
			area: `${line}L${x(end).toFixed(2)} 100L0 100Z`,
			dot: { x: x(end), y: y(plotted[end]) }
		};
	});

	// Mixed off the accent stop by stop, so the wash follows the line's colour
	// through dark mode without being told. See `WASH_RAMP`.
	const washStops = $derived(
		WASH_RAMP.map(([offset, share]) => ({
			offset: `${offset * 100}%`,
			color: `color-mix(in oklab, var(--chart-accent), transparent ${(100 - share * alpha * 100).toFixed(2)}%)`
		}))
	);
</script>

{#if geometry}
	<div class="spark relative h-full w-full">
		<!-- Decorative: the number above it is the accessible reading of this. -->
		<svg
			class="block h-full w-full"
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<defs>
				<linearGradient id="spark-wash-{uid}" x1="0" y1="0" x2="0" y2="1">
					{#each washStops as stop (stop.offset)}
						<stop offset={stop.offset} stop-color={stop.color} />
					{/each}
				</linearGradient>
			</defs>

			<path
				class="health-area"
				style="animation-delay: {delay}ms"
				d={geometry.area}
				fill="url(#spark-wash-{uid})"
			/>

			<!-- `pathLength="1"` normalizes the dash math, so the shared draw-in
			     keyframes work whatever this path's real length is. -->
			<path
				class="health-line"
				style="animation-delay: {delay}ms"
				d={geometry.line}
				pathLength="1"
				fill="none"
				stroke="var(--chart-accent)"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		</svg>

		<!-- The end of the line, as a real element rather than a `<circle>`: under
		     `preserveAspectRatio="none"` a circle is drawn as an ellipse, and the
		     one mark that has to read as a dot is the one that can't be stretched.
		     It also anchors the headline number to the point it came from, which is
		     the whole reason the number and the line sit in one tile. -->
		<span
			class="spark-dot"
			style="left: {geometry.dot.x}%; top: {geometry.dot.y}%; animation-delay: {delay + 140}ms"
		></span>
	</div>
{/if}

<style>
	/* The stroke sits astride the path, so half of it hangs over the top edge on
	   the highest point. `valueDomain`'s headroom keeps the line off the very top
	   in practice; this covers the case where it doesn't. */
	.spark :global(svg) {
		overflow: visible;
	}

	.spark-dot {
		position: absolute;
		width: 5px;
		height: 5px;
		border-radius: 9999px;
		background: var(--chart-accent);
		transform: translate(-50%, -50%);
		/* Cut out of whatever the tile's surface is, so the dot reads as a point on
		   the line rather than a bead sitting in the wash under it. The tile sets
		   the property; a sparkline on an unset surface just gets no ring. */
		box-shadow: 0 0 0 2px var(--spark-dot-ring, transparent);
		animation: health-area-in 200ms var(--ease-out-fast) both;
	}

	/* The delay is up to ~300ms with the stagger, and the global reduced-motion
	   rule collapses durations without touching delays — so this has to be
	   cancelled outright rather than shortened, or the dot sits invisible and
	   then pops. Same reasoning as the /health sections in `app.css`. */
	@media (prefers-reduced-motion: reduce) {
		.spark-dot {
			animation: none;
		}
	}
</style>

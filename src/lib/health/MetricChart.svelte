<script>
	import { Area, Chart, Highlight, LinearGradient, Points, Spline, Svg } from 'layerchart';
	import { scaleLinear } from 'd3-scale';
	import { isFilled, isolatedPoints, valueDomain } from '$lib/health/metrics.js';

	/**
	 * A sparkline, not a graph: no axes, no gridlines, no tooltip box.
	 *
	 * Scrubbing is reported up rather than handled here, and the marker is drawn
	 * from the `active` index handed back down — so every chart on the page marks
	 * the same day, whichever one the pointer is over.
	 */
	let { values, label, delay = 0, active = null, onscrub } = $props();

	const points = $derived(values.map((value, i) => ({ i, value })));

	// A reading with a gap on both sides has no segment to stroke. Without these
	// dots a single day of data draws an empty box.
	const orphans = $derived(isolatedPoints(values));

	const domain = $derived(valueDomain(values));

	let context = $state();
	const hovered = $derived(context?.tooltip?.data ?? null);

	const marked = $derived(active === null ? null : points[active]);
	const defined = (d) => isFilled(d.value);

	$effect(() => {
		onscrub?.(hovered === null ? null : hovered.i);
	});
</script>

<div class="h-full w-full" role="img" aria-label={label}>
	<Chart
		data={points}
		x="i"
		y="value"
		xScale={scaleLinear()}
		yScale={scaleLinear()}
		yDomain={domain}
		padding={{ top: 6, bottom: 6 }}
		tooltipContext={{ mode: 'bisect-x' }}
		bind:context
	>
		{#snippet children()}
			<Svg>
				<!-- Area fill earns its place only as a wash: it fades out downward, so
				     it reads as weight under the line rather than a second shape. -->
				<LinearGradient
					vertical
					stops={[
						['0%', 'var(--chart-wash-top)'],
						['100%', 'var(--chart-wash-bottom)']
					]}
				>
					{#snippet children({ gradient })}
						<Area
							class="health-area"
							style="animation-delay: {delay}ms"
							fill={gradient}
							{defined}
						/>
					{/snippet}
				</LinearGradient>

				<!-- The stroke fades in from the left edge, so the oldest end of the
				     window trails off instead of being cut by the chart border. -->
				<LinearGradient
					stops={[
						['0%', 'var(--chart-accent-0)'],
						['8%', 'var(--chart-accent)'],
						['100%', 'var(--chart-accent)']
					]}
				>
					{#snippet children({ gradient })}
						<Spline
							class="health-line"
							pathLength="1"
							style="animation-delay: {delay}ms"
							stroke={gradient}
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							fill="none"
							{defined}
						/>
					{/snippet}
				</LinearGradient>

				{#if orphans.length}
					<Points
						class="health-dot"
						style="animation-delay: {delay}ms"
						data={orphans}
						r={2.5}
						fill="var(--chart-accent)"
					/>
				{/if}

				<!-- The rule marks the day on every chart; the dot only appears where
				     that day actually has a reading. -->
				{#if marked}
					<Highlight data={marked} axis="x" motion="none" lines />
					{#if isFilled(marked.value)}
						<Highlight
							data={marked}
							axis="none"
							motion="none"
							points={{ r: 3, fill: 'var(--chart-accent)' }}
						/>
					{/if}
				{/if}
			</Svg>
		{/snippet}
	</Chart>
</div>

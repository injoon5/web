<script>
	import { Area, Chart, Highlight, LinearGradient, Spline, Svg } from 'layerchart';
	import { scaleLinear } from 'd3-scale';
	import { valueDomain } from '$lib/health/metrics.js';

	/**
	 * A sparkline, not a graph: no axes, no gridlines, no tooltip box. Scrubbing
	 * reports the hovered index back up so the section headline changes in place.
	 */
	let { values, label, delay = 0, onscrub } = $props();

	const points = $derived(values.map((value, i) => ({ i, value })));
	const domain = $derived(valueDomain(values));

	let context = $state();
	const active = $derived(context?.tooltip?.data ?? null);

	const defined = (d) => d.value !== null;

	$effect(() => {
		onscrub?.(active === null ? null : active.i);
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

				<!-- A day with no data breaks the line; there is nothing to point at either. -->
				{#if active !== null && active.value !== null}
					<Highlight axis="none" points={{ r: 3, fill: 'var(--chart-accent)' }} />
				{/if}
			</Svg>
		{/snippet}
	</Chart>
</div>

<script>
	import MetricChart from '$lib/health/MetricChart.svelte';
	import {
		formatDay,
		formatPointLabel,
		formatValue,
		lastFilledIndex
	} from '$lib/health/metrics.js';

	/**
	 * The number is the headline, the chart is the footnote. Scrubbing the chart
	 * replaces the headline in place rather than floating a tooltip over the line.
	 */
	let { metric, series, index = 0 } = $props();

	const values = $derived(series?.values ?? []);
	const latest = $derived(lastFilledIndex(values));

	let scrubbed = $state(null);
	const shown = $derived(scrubbed !== null && values[scrubbed] !== null ? scrubbed : latest);

	const value = $derived(shown >= 0 ? values[shown] : null);
	const when = $derived(
		shown >= 0 ? formatPointLabel(series.start, series.step, shown) : 'No data yet'
	);

	const first = $derived(values.length ? formatDay(series.start) : '');
	const last = $derived(
		values.length ? formatDay(series.start + (values.length - 1) * series.step) : ''
	);

	const hasData = $derived(latest >= 0);
</script>

<section class="health-section" style="--stagger: {index * 100}ms">
	<h2 class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{metric.label}</h2>

	<p class="mt-1 flex items-baseline gap-1.5">
		<span
			class="text-3xl font-medium tracking-tight text-neutral-900 tabular-nums transition-opacity duration-150 ease-out dark:text-neutral-100"
		>
			{formatValue(value, metric.decimals)}
		</span>
		{#if metric.unit && value !== null}
			<span class="text-sm font-medium text-neutral-500 dark:text-neutral-500">{metric.unit}</span>
		{/if}
	</p>
	<p class="mt-0.5 text-sm text-neutral-500 tabular-nums dark:text-neutral-500">{when}</p>

	<!-- Height is reserved up front: the chart only draws after hydration, and the
	     page must not shift underneath the numbers when it does. -->
	<div class="mt-4 h-[120px] w-full">
		{#if hasData}
			<MetricChart
				{values}
				label="{metric.label} over the last {values.length} points"
				delay={index * 100}
				onscrub={(i) => (scrubbed = i)}
			/>
		{/if}
	</div>

	{#if hasData}
		<div
			class="mt-1 flex justify-between text-xs text-neutral-400 tabular-nums dark:text-neutral-600"
		>
			<span>{first}</span>
			<span>{last}</span>
		</div>
	{/if}
</section>

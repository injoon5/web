<script>
	import MetricChart from '$lib/health/MetricChart.svelte';
	import {
		formatDay,
		formatPointLabel,
		formatValue,
		isFilled,
		lastFilledIndex
	} from '$lib/health/metrics.js';

	/**
	 * The number is the headline, the chart is the footnote. Scrubbing any chart
	 * replaces every headline in place rather than floating a tooltip over the
	 * line — `active` is the page's shared day, not this section's.
	 */
	let { metric, series, index = 0, active = null, onscrub } = $props();

	const values = $derived(series?.values ?? []);
	const latest = $derived(lastFilledIndex(values));

	// A hovered day reads across the whole page, so a metric with no reading that
	// day shows a dash rather than quietly falling back to its own latest value.
	const shown = $derived(active !== null && active < values.length ? active : latest);

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
		<!-- No transition on the number: scrubbing is direct manipulation, and a
		     value easing toward the day under the pointer reads as lag. -->
		<span
			class="text-3xl font-medium tracking-tight text-neutral-900 tabular-nums dark:text-neutral-100"
		>
			{formatValue(value, metric.decimals)}
		</span>
		{#if metric.unit && isFilled(value)}
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
				{active}
				label="{metric.label} over the last {values.length} points"
				delay={index * 100}
				{onscrub}
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

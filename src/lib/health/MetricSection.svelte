<script>
	import MetricChart from '$lib/health/MetricChart.svelte';
	import { chartSettings } from '$lib/health/chart-settings.svelte.js';
	import {
		formatDay,
		formatPointLabel,
		formatValue,
		isFilled,
		lastFilledIndex,
		valueAt
	} from '$lib/health/metrics.js';

	/**
	 * The number is the headline, the chart is the footnote. Scrubbing any chart
	 * replaces every headline in place rather than floating a tooltip over the
	 * line — `active` is the page's shared day, not this section's.
	 */
	let { metric, series, index = 0, active = null, onscrub } = $props();

	const values = $derived(series?.values ?? []);
	const latest = $derived(lastFilledIndex(values));

	// A hovered day reads across the whole page. Inside the tracked window a day
	// this metric skipped is a zero, the same as the chart draws it; past the
	// newest reading there is nothing to report yet, so it dashes.
	const shown = $derived(active !== null && active < values.length ? active : latest);

	const value = $derived(valueAt(values, shown));
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
	<div
		class="health-plot-box mt-4 w-full"
		style="--chart-h: {chartSettings.height}px; --chart-h-sm: {chartSettings.heightSm}px"
	>
		{#if hasData}
			<MetricChart
				{values}
				{active}
				decimals={metric.decimals}
				label="{metric.label} over the last {values.length} points"
				delay={index * 100}
				{onscrub}
			/>
		{/if}
	</div>

	{#if hasData}
		<!-- Flush with the section, not indented to the plot: the heading, the
		     number, the axis labels and this row all start on one column, which
		     reads as alignment. The 34px between this date and the first point is
		     a gap nobody measures; four staggered left edges is one anybody sees. -->
		<div
			class="mt-1 flex justify-between text-xs text-neutral-400 tabular-nums dark:text-neutral-600"
		>
			<span>{first}</span>
			<span>{last}</span>
		</div>
	{/if}
</section>

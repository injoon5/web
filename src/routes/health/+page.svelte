<script>
	import MetricSection from '$lib/health/MetricSection.svelte';
	import ScoreDial from '$lib/health/ScoreDial.svelte';
	import {
		DEFAULT_RANGE,
		PAGE_METRICS,
		RANGES,
		dayScore,
		formatPointLabel,
		formatRelative,
		formatStamp,
		latestIndex,
		rangeStartDate
	} from '$lib/health/metrics.js';

	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';

	const DESCRIPTION = 'Steps, sleep and movement, straight off an Apple Watch.';

	let { data } = $props();

	// The range lives here rather than in the URL: every distinct `days` value is
	// a distinct Convex cache entry, and a query string is a lever anyone can
	// pull. The server renders `DEFAULT_RANGE`; this only moves the subscription.
	let days = $state(DEFAULT_RANGE);

	// The window pivots on the end the server resolved, so switching ranges can't
	// drift the page a day away from what was rendered.
	const startDate = $derived(data.endDate ? rangeStartDate(data.endDate, days) : null);

	// Server-rendered numbers first, then the same window over a Convex
	// subscription: an ingest from the Shortcut pushes straight into the page.
	// `initialData` means the live query never shows a loading state.
	const live = useQuery(
		api.healthPublic.page,
		() => (startDate ? { startDate, days } : 'skip'),
		() => ({
			initialData: { series: data.series, updatedAt: data.updatedAt },
			keepPreviousData: true
		})
	);

	const series = $derived(live.data?.series ?? data.series);
	const updatedAt = $derived(live.data?.updatedAt ?? data.updatedAt);

	const byMetric = $derived(new Map(series.map((s) => [s.metric, s])));
	const sections = $derived(
		PAGE_METRICS.map((metric) => ({ metric, series: byMetric.get(metric.key) })).filter(
			(s) => s.series
		)
	);

	/**
	 * One hovered day for the whole page.
	 *
	 * Each chart reports its own scrub, and clears it on the way out — but moving
	 * between two charts can land that clear after the next chart's first move.
	 * Only the chart that owns the current value is allowed to clear it.
	 */
	let scrubbed = $state(null);
	let scrubSource = null;

	function setScrub(key, index) {
		if (index === null) {
			if (scrubSource === key) {
				scrubbed = null;
				scrubSource = null;
			}
			return;
		}
		scrubSource = key;
		scrubbed = index;
	}

	function selectRange(range) {
		if (range === days) return;
		days = range;
		// Point counts change with the range, so a held index would mark a
		// different day than the one under the pointer.
		scrubbed = null;
		scrubSource = null;
	}

	const newest = $derived(latestIndex(sections));
	const shown = $derived(scrubbed !== null && scrubbed <= newest ? scrubbed : newest);
	const score = $derived(dayScore(sections, shown));

	const anySeries = $derived(sections[0]?.series);
	const shownDay = $derived(
		shown >= 0 && anySeries ? formatPointLabel(anySeries.start, anySeries.step, shown) : ''
	);
</script>

<svelte:head>
	<title>Health — Injoon Oh</title>
	<meta name="description" content={DESCRIPTION} />
	<meta property="og:title" content="Health — Injoon Oh" />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:image" content="https://www.injoon5.com/api/og?template=health" />
	<meta property="og:url" content="https://www.injoon5.com/health" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="https://www.injoon5.com/api/og?template=health" />
</svelte:head>

<div class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
	<!-- The score sits beside the title from `md` up and drops under the
	     description below it. Not `sm`: at 640px the dial takes enough of the row
	     to break the description onto four ragged lines and orphan the caption. -->
	<div class="mt-20 flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-10">
		<div>
			<h1
				class="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-2xl dark:text-neutral-100"
			>
				Health
			</h1>
			<p
				class="text-md text-xl font-medium tracking-tight text-neutral-500 sm:text-xl dark:text-neutral-500"
			>
				Steps, sleep and movement, <br />straight off an Apple Watch.
			</p>
			{#if updatedAt}
				<p class="mt-2 text-sm text-neutral-400 dark:text-neutral-600">
					Updated <time datetime={new Date(updatedAt).toISOString()} title={formatStamp(updatedAt)}
						>{formatRelative(updatedAt)}</time
					>
				</p>
			{/if}
		</div>

		{#if sections.length}
			<ScoreDial score={score.score} counted={score.counted} of={score.of} when={shownDay} />
		{/if}
	</div>

	{#if sections.length}
		<!-- `-ml-3` pulls the first pill's text back onto the page's left edge, so
		     the row optically aligns with the title above it despite its padding.
		     The `after` block is invisible hit slop: a 32px pill is comfortable to
		     look at and too small to tap, so the target reaches 48px instead. -->
		<nav aria-label="Range" class="mt-10 -ml-3 flex items-center gap-1 text-sm">
			{#each RANGES as range}
				<button
					type="button"
					onclick={() => selectRange(range)}
					aria-pressed={range === days}
					class="relative rounded-full px-3 py-1.5 font-medium tabular-nums transition-[background-color,color,transform] duration-150 ease-out select-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 active:scale-95 {range ===
					days
						? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
						: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100'}"
				>
					{range}
				</button>
			{/each}
			<span class="ml-2 text-neutral-400 dark:text-neutral-600">days</span>
		</nav>

		<!-- Two columns from lg up, where each still gets ~440px — enough that a
		     90-day line reads. Below that they stack rather than cramp. -->
		<div
			class="my-12 grid grid-cols-1 gap-x-12 gap-y-10 transition-opacity duration-150 lg:grid-cols-2 lg:gap-y-14 {live.isStale
				? 'opacity-60'
				: ''}"
		>
			{#each sections as section, i (section.metric.key)}
				<MetricSection
					metric={section.metric}
					series={section.series}
					index={i}
					active={scrubbed}
					onscrub={(at) => setScrub(section.metric.key, at)}
				/>
			{/each}
		</div>
	{:else}
		<p class="my-12 text-base text-neutral-400 dark:text-neutral-600">
			Nothing here yet — the Shortcut hasn't sent anything.
		</p>
	{/if}
</div>

<script>
	import HealthDialsMount from '$lib/health/HealthDialsMount.svelte';
	import MetricSection from '$lib/health/MetricSection.svelte';
	import RangePicker from '$lib/health/RangePicker.svelte';
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
		rangeStartDate,
		trimToLatest
	} from '$lib/health/metrics.js';

	import { chartSettings } from '$lib/health/chart-settings.svelte.js';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';

	const DESCRIPTION = 'Steps, movement and energy, straight off an Apple Watch.';

	/**
	 * Everything in a section that isn't the chart — heading, number, both date
	 * lines and the margins between them. Added to the chart height, it is what a
	 * section measures, which is what the streaming placeholder has to reserve.
	 */
	const SECTION_CHROME = 118;

	let { data } = $props();

	// The range lives here rather than in the URL: every distinct `days` value is
	// a distinct Convex cache entry, and a query string is a lever anyone can
	// pull. The server renders `DEFAULT_RANGE`; this only moves the subscription.
	let days = $state(DEFAULT_RANGE);

	// The window pivots on the end the server resolved, so switching ranges can't
	// drift the page a day away from what was rendered. It arrives in the first
	// streamed chunk, so the subscription opens without waiting for the series.
	const startDate = $derived(data.endDate ? rangeStartDate(data.endDate, days) : null);

	/**
	 * The same window over a Convex subscription, so an ingest from the Shortcut
	 * pushes straight into the page.
	 *
	 * No `initialData`: the server's copy of this window is streamed rather than
	 * awaited, so there is nothing to seed the query with at subscribe time. The
	 * markup falls back to the streamed value until the socket answers, which
	 * covers exactly the same gap without holding up the response.
	 */
	const live = useQuery(
		api.healthPublic.page,
		() => (startDate ? { startDate, days } : 'skip'),
		() => ({ keepPreviousData: true })
	);

	/**
	 * Sections for a resolved page payload, live or streamed.
	 *
	 * A plain function rather than a `$derived`, because the streamed half only
	 * exists inside an `{#await}` block. It is called from a `{@const}` in each
	 * block, which re-runs when `live.data` changes — four map lookups, so
	 * running it twice costs nothing worth threading state around to avoid.
	 */
	function sectionsOf(page) {
		const byMetric = new Map((page?.series ?? []).map((s) => [s.metric, s]));
		const sections = PAGE_METRICS.map((metric) => ({
			metric,
			series: byMetric.get(metric.key)
		})).filter((s) => s.series);

		// The window runs a day past UTC-today to catch a phone filing tomorrow's
		// date; until something lands there, that day is not on the axis.
		return trimToLatest(sections);
	}

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
		// A pointer reports every frame it moves, but the day under it changes far
		// less often — on a 7-day window, once every fiftieth event or so. Writing
		// the same index back would re-render every section and the dial for
		// nothing, so the assignment is guarded rather than the renders.
		if (scrubbed !== index) scrubbed = index;
	}

	function selectRange(range) {
		if (range === days) return;
		days = range;
		// Point counts change with the range, so a held index would mark a
		// different day than the one under the pointer.
		scrubbed = null;
		scrubSource = null;
	}

	/** The day every headline, marker and the score are describing. */
	function shownIndex(sections) {
		const newest = latestIndex(sections);
		return scrubbed !== null && scrubbed <= newest ? scrubbed : newest;
	}

	function shownDay(sections, shown) {
		const series = sections[0]?.series;
		return shown >= 0 && series ? formatPointLabel(series.start, series.step, shown) : '';
	}
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
	     to break the description onto four ragged lines and orphan the caption.

	     Everything outside the `{#await}` blocks is in the first streamed chunk,
	     so the title and description paint without waiting on Convex. -->
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
				Steps, movement and energy, <br />straight off an Apple Watch.
			</p>

			<!-- Reserved rather than conditional: this line arrives with the streamed
			     chunk, and the header must not jump when it does. -->
			<p class="mt-2 h-5 text-sm text-neutral-400 dark:text-neutral-600">
				{#await data.report then streamed}
					{@const updatedAt = (live.data ?? streamed)?.updatedAt}
					{#if updatedAt}
						Updated <time
							datetime={new Date(updatedAt).toISOString()}
							title={formatStamp(updatedAt)}>{formatRelative(updatedAt)}</time
						>
					{/if}
				{/await}
			</p>
		</div>

		{#await data.report then streamed}
			{@const sections = sectionsOf(live.data ?? streamed)}
			{#if sections.length}
				{@const shown = shownIndex(sections)}
				{@const score = dayScore(sections, shown)}
				<ScoreDial
					score={score.score}
					counted={score.counted}
					of={score.of}
					when={shownDay(sections, shown)}
				/>
			{/if}
		{/await}
	</div>

	{#await data.report}
		<!-- The real grid, held open with empty boxes rather than a guessed height:
		     one column on a phone and two from `lg`, so the streamed chunk drops
		     into a space that already exists at every breakpoint instead of
		     shoving the page down when it lands. Empty, not shimmering — the gap
		     is a few dozen milliseconds, and four pulsing blocks would be the most
		     eye-catching thing on a page about resting heart rates. -->
		<div class="mt-10 h-8" aria-hidden="true"></div>
		<div
			class="my-12 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-2 lg:gap-y-14"
			aria-hidden="true"
		>
			{#each PAGE_METRICS as metric (metric.key)}
				<div
					class="health-plot-box"
					style="--chart-h: {chartSettings.height +
						SECTION_CHROME}px; --chart-h-sm: {chartSettings.heightSm + SECTION_CHROME}px"
				></div>
			{/each}
		</div>
	{:then streamed}
		{@const sections = sectionsOf(live.data ?? streamed)}

		{#if sections.length}
			<div class="mt-10">
				<RangePicker ranges={RANGES} value={days} onselect={selectRange} />
			</div>

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
	{/await}

	<!-- Preview deployments only, and compiled out entirely everywhere else. -->
	<HealthDialsMount />
</div>

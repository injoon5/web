<script>
	import MetricSection from '$lib/health/MetricSection.svelte';
	import {
		PAGE_METRICS,
		RANGES,
		formatFullDay,
		workoutDetails,
		workoutLabel
	} from '$lib/health/metrics.js';

	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';

	let { data } = $props();

	// Server-rendered numbers first, then the same window over a Convex
	// subscription: an ingest from the Shortcut pushes straight into the page.
	// `initialData` means the live query never shows a loading state, and
	// `startDate` is the server's window, not a clock read on the client.
	const live = useQuery(
		api.healthPublic.page,
		() => (data.startDate ? { startDate: data.startDate, days: data.days } : 'skip'),
		() => ({
			initialData: { series: data.series, workouts: data.workouts },
			keepPreviousData: true
		})
	);

	const series = $derived(live.data?.series ?? data.series);
	const workouts = $derived(live.data?.workouts ?? data.workouts);

	const byMetric = $derived(new Map(series.map((s) => [s.metric, s])));
	const sections = $derived(
		PAGE_METRICS.map((metric) => ({ metric, series: byMetric.get(metric.key) })).filter(
			(s) => s.series
		)
	);
</script>

<svelte:head>
	<title>Health — Injoon Oh</title>
	<meta name="description" content="Steps, heart rate and workouts, straight off an Apple Watch." />
	<meta property="og:title" content="Health — Injoon Oh" />
	<meta
		property="og:description"
		content="Steps, heart rate and workouts, straight off an Apple Watch."
	/>
	<meta property="og:url" content="https://www.injoon5.com/health" />
</svelte:head>

<div class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
	<h1
		class="mt-20 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-2xl dark:text-neutral-100"
	>
		Health
	</h1>
	<h2
		class="text-md text-xl font-medium tracking-tight text-neutral-500 sm:text-xl dark:text-neutral-500"
	>
		Steps, heart rate and workouts, <br />straight off an Apple Watch.
	</h2>

	{#if sections.length}
		<nav aria-label="Range" class="mt-10 flex items-center gap-4 text-sm">
			{#each RANGES as range}
				<a
					href="?days={range}"
					data-sveltekit-noscroll
					aria-current={range === data.days ? 'page' : 'false'}
					class="font-medium tabular-nums transition-colors duration-150 {range === data.days
						? 'text-neutral-900 dark:text-neutral-100'
						: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100'}"
				>
					{range}
				</a>
			{/each}
			<span class="text-sm text-neutral-400 dark:text-neutral-600">days</span>
		</nav>

		<!-- Two columns from lg up, where each still gets ~440px — enough that a
		     90-day line reads. Below that they stack rather than cramp. -->
		<div class="my-12 grid grid-cols-1 gap-x-12 gap-y-14 lg:grid-cols-2">
			{#each sections as section, i (section.metric.key)}
				<MetricSection metric={section.metric} series={section.series} index={i} />
			{/each}
		</div>
	{:else}
		<p class="my-12 text-base text-neutral-400 dark:text-neutral-600">
			Nothing here yet — the Shortcut hasn't sent anything.
		</p>
	{/if}

	{#if workouts.length}
		<section class="mb-12">
			<h2 class="text-sm font-medium text-neutral-900 dark:text-neutral-100">Workouts</h2>
			<div class="mt-4 grid w-full grid-cols-1 divide-y divide-neutral-200 dark:divide-neutral-700">
				{#each workouts as workout (workout.id)}
					<div class="py-2">
						<div class="flex flex-row items-baseline justify-between gap-2">
							<span
								class="line-clamp-1 text-base font-medium text-neutral-900 dark:text-neutral-100"
							>
								{workoutLabel(workout.type)}
							</span>
							<span
								class="ml-4 shrink-0 text-base font-medium whitespace-nowrap text-neutral-500 tabular-nums dark:text-neutral-400"
							>
								{formatFullDay(workout.start)}
							</span>
						</div>
						<p class="text-sm font-medium text-neutral-500 tabular-nums dark:text-neutral-500">
							{workoutDetails(workout).join(' · ')}
						</p>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

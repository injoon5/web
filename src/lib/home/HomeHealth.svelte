<script>
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import { dateKey, shiftDateKey } from '$convex/lib/health.js';
	import Sparkline from '$lib/health/Sparkline.svelte';
	import {
		DEFAULT_RANGE,
		PAGE_METRICS,
		dayScore,
		formatDay,
		formatValue,
		isFilled,
		latestIndex,
		scoreLabel,
		scoreTone,
		trimToLatest,
		valueAt
	} from '$lib/health/metrics.js';

	/**
	 * The home page's health beat: four numbers, four sparklines and the day's
	 * score, sitting between two image-heavy sections.
	 *
	 * It is deliberately the quiet one. Now Listening is a full-bleed marquee of
	 * album art and Photos is a grid of photographs; a third block of imagery
	 * between them would be noise. Numbers set in the page's own type, with one
	 * thin orange line under each, is the counterpoint — and it is the only thing
	 * on the page that says something about today.
	 *
	 * ## The window
	 *
	 * `days: 30` and a UTC end date are not arbitrary: they are exactly what
	 * `/health`'s server render asks for. Convex caches a query by its arguments,
	 * so this subscription lands on the same entry that page already keeps warm
	 * rather than opening a second one. The home page is prerendered, so the
	 * window can't come from a server load — it is resolved at hydration from the
	 * visitor's clock, and `dateKey` is UTC, so every visitor on earth asks for
	 * the same window.
	 *
	 * ## What it costs
	 *
	 * Nothing until hydration, and no chart library ever: `Sparkline` is two path
	 * strings. `/health` pulls in layerchart, d3-scale and d3-shape, which is the
	 * right trade on a page whose whole subject is the chart and the wrong one on
	 * the page that has to paint first.
	 */

	// A day key is written in the phone's local calendar, which can be a day ahead
	// of UTC — same reason `/health`'s load reaches a day past today. The extra
	// slot is empty for anyone at or behind UTC, which is what a day with no data
	// looks like, and `trimToLatest` drops it until something lands there.
	const endDate = dateKey(Date.now() + 86400000);
	const startDate = shiftDateKey(endDate, -(DEFAULT_RANGE - 1));

	const health = useQuery(api.healthPublic.page, () => ({ startDate, days: DEFAULT_RANGE }));

	const sections = $derived.by(() => {
		const page = health.data;
		if (!page) return [];

		const byMetric = new Map(page.series.map((series) => [series.metric, series]));
		return trimToLatest(
			PAGE_METRICS.map((metric) => ({ metric, series: byMetric.get(metric.key) })).filter(
				(section) => section.series
			)
		);
	});

	const seriesFor = $derived(new Map(sections.map(({ metric, series }) => [metric.key, series])));

	// One day for all four readings and the score, exactly as /health does it: the
	// newest index any metric reported. A metric that hasn't synced yet shouldn't
	// drag the other three back a day with it.
	const shown = $derived(latestIndex(sections));
	const ready = $derived(sections.length > 0 && shown >= 0);

	// Slots in the window, so four lines that stop on different days still measure
	// x against one calendar and end where they actually end.
	const span = $derived(sections[0]?.series?.values.length ?? 0);

	const score = $derived(dayScore(sections, shown));
	// Month and day, not the full date /health prints: the label column is ~122px
	// wide beside the ring, and "Aug 6, 2026 · 3 of 4" wraps there with the last
	// digit orphaned on its own line. The year carries nothing here — this number
	// is hours old, not archival.
	const day = $derived.by(() => {
		const series = sections[0]?.series;
		return ready && series ? formatDay(series.start + shown * series.step) : '';
	});

	// The count only earns its place when the day is short a metric — "4 of 4" on
	// a full day is noise, and it is the partial day that needs explaining.
	const caption = $derived(
		score.counted > 0 && score.counted < score.of
			? `${day} · ${score.counted}\u00a0of\u00a0${score.of}`
			: day
	);

	// r=40 in an 88 box, the same geometry as /health's dial, so the two rings are
	// the same drawing at two sizes rather than two drawings.
	const RADIUS = 40;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
	const offset = $derived(
		CIRCUMFERENCE * (1 - (score.score === null ? 0 : Math.max(0, Math.min(score.score, 100)) / 100))
	);

	/** Enter delay for tile `i`. Short — a long cascade reads as the page being slow. */
	const stagger = (i) => i * 70;
</script>

<div
	id="health"
	class="mt-20 mb-12 grid grid-cols-3 text-lg font-medium tracking-tight sm:grid-cols-5 sm:text-xl md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 flex flex-col justify-start md:col-span-10 lg:col-span-2">
		<div class="md:sticky md:top-24" style="height: max-content;">
			<a href="/health" class="group">
				<h2
					class="text-xl font-medium tracking-tight text-balance text-neutral-900 group-hover:text-neutral-600 dark:text-neutral-100 dark:group-hover:text-neutral-400"
				>
					Health
				</h2>
			</a>

			<!-- The ring is the section's one focal point, and it is drawn empty from
			     the first paint rather than held back: an unfilled track is a real
			     resting state, so the arc winding up when the socket answers is the
			     reveal instead of a box appearing. Reserved height either way, so
			     nothing under it moves. -->
			<div class="mt-2.5 flex items-center gap-2.5">
				<!-- Only a real score gets a name; the empty track on its own is
				     decoration, and "Health score loading" is not something anyone
				     needs read to them. -->
				<div
					class="relative h-11 w-11 shrink-0"
					role={ready && score.score !== null ? 'img' : undefined}
					aria-hidden={ready && score.score !== null ? undefined : 'true'}
					aria-label={ready && score.score !== null
						? `Health score ${score.score} out of 100`
						: undefined}
				>
					<svg viewBox="0 0 88 88" class="h-11 w-11 -rotate-90" aria-hidden="true">
						<circle
							cx="44"
							cy="44"
							r={RADIUS}
							fill="none"
							stroke="var(--chart-track)"
							stroke-width="7"
						/>
						<circle
							class="home-score-ring"
							cx="44"
							cy="44"
							r={RADIUS}
							fill="none"
							stroke={scoreTone(ready ? score.score : null)}
							stroke-width="7"
							stroke-linecap="round"
							stroke-dasharray={CIRCUMFERENCE}
							stroke-dashoffset={offset}
						/>
					</svg>
					<span
						class="absolute inset-0 flex items-center justify-center text-sm font-medium tracking-tight text-neutral-900 tabular-nums dark:text-neutral-100"
					>
						{ready && score.score !== null ? score.score : ''}
					</span>
				</div>

				<div class="min-w-0 leading-tight">
					{#if ready}
						<p class="home-health-in text-sm font-medium text-neutral-900 dark:text-neutral-100">
							{scoreLabel(score.score)}
						</p>
						<p
							class="home-health-in text-sm font-medium text-neutral-500 tabular-nums dark:text-neutral-500"
						>
							{caption}
						</p>
					{:else if !health.error}
						<span class="shimmer block h-4 w-20" aria-hidden="true"></span>
						<span class="shimmer mt-1 block h-4 w-24" aria-hidden="true"></span>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<div class="col-span-10 mt-4 justify-center lg:mt-0">
		{#if health.error}
			<div class="text-base text-neutral-700 dark:text-neutral-300">
				<p>Couldn't load Health</p>
				<div class="mt-1 text-neutral-500 dark:text-neutral-500">
					{health.error.message ?? 'Unknown error'}
				</div>
			</div>
		{:else}
			<!-- Four tiles, and the labels are in the prerendered HTML: the section
			     paints its own shape before a socket is even open, and the numbers
			     drop into a layout that already exists. -->
			<!-- Two up until `md`, four after — the break is where the numbers stop
			     fitting rather than at a device width. This column runs full-bleed
			     below `lg` and then narrows to 10 of 12, so four across at `sm` would
			     leave ~108px inside a tile, which "1,234 kcal" does not fit at the
			     size this number wants to be read at. -->
			<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
				{#each PAGE_METRICS as metric, i (metric.key)}
					{@const series = seriesFor.get(metric.key)}
					{@const value = series ? valueAt(series.values, shown) : null}
					<div class="home-health-tile flex flex-col bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
						<p class="text-sm font-medium text-neutral-500 dark:text-neutral-500">
							{metric.short}
						</p>

						<p class="mt-0.5 flex h-8 items-baseline gap-1 lg:h-9">
							{#if series}
								<span
									class="home-health-in text-2xl font-medium tracking-tight text-neutral-900 tabular-nums lg:text-3xl dark:text-neutral-100"
									style="--stagger: {stagger(i)}ms"
								>
									{formatValue(value, metric.decimals)}
								</span>
								{#if metric.unit && isFilled(value)}
									<span
										class="home-health-in text-sm font-medium text-neutral-500 dark:text-neutral-500"
										style="--stagger: {stagger(i)}ms"
									>
										{metric.unit}
									</span>
								{/if}
							{:else}
								<span class="shimmer block h-6 w-16 self-center" aria-hidden="true"></span>
							{/if}
						</p>

						<!-- Reserved before the data lands, so the tile never grows under
						     the cursor. Taller from `lg`, where the tile is wide enough
						     that 36px of height reads as a flat line. -->
						<div class="mt-3 h-9 w-full lg:h-11">
							{#if series}
								<Sparkline values={series.values} {span} delay={stagger(i)} />
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-2 flex justify-end">
				<a
					class="group relative inline-flex items-center text-base font-medium tracking-normal text-neutral-600 transition-colors duration-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100"
					href="/health"
				>
					<span class="transition-transform duration-200 group-hover:-translate-x-5">
						See the full history
					</span>
					<span
						class="absolute right-0 mr-1 translate-x-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					>
						→
					</span>
				</a>
			</div>
		{/if}
	</div>
</div>

<style>
	/* The surface the sparkline's end dot punches its ring out of, so the dot
	   reads as a point on the line rather than a bead in the wash. */
	.home-health-tile {
		--spark-dot-ring: var(--color-neutral-100);
	}

	:global(.dark) .home-health-tile {
		--spark-dot-ring: var(--color-neutral-900);
	}

	/* A transition rather than a keyframe: the arc's resting state is empty, so
	   the reveal is just the offset changing when the query answers — and if a
	   fresh ingest lands mid-wind it retargets from wherever it is instead of
	   snapping back to zero. Slower than a UI transition because it is not
	   feedback; it is the one thing on the section that has to be watched. The
	   colour follows more quickly, so a band change reads as part of the same
	   move rather than a second event.

	   `stroke-dashoffset` on a 44px ring is cheap, and the global reduced-motion
	   rule collapses both durations, which lands the ring on its final value with
	   no motion at all. */
	.home-score-ring {
		transition:
			stroke-dashoffset 640ms var(--ease-out-fast),
			stroke 320ms var(--ease-out-fast);
	}

	/* Values arrive over a socket, so they animate on mount rather than on a
	   state change — the element does not exist until there is something to show.
	   `health-section-in` is the /health sections' own keyframe (opacity and 4px
	   of rise), reused so the two pages settle the same way. */
	.home-health-in {
		animation: health-section-in 220ms var(--ease-out-fast) both;
		animation-delay: var(--stagger, 0ms);
	}

	/* Cancelled outright rather than shortened: the global rule collapses
	   `animation-duration` and leaves `animation-delay` alone, so a staggered
	   element would sit at `opacity: 0` for its delay and then pop. */
	@media (prefers-reduced-motion: reduce) {
		.home-health-in {
			animation: none;
		}
	}
</style>

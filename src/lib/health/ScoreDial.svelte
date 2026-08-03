<script>
	import { scoreLabel, scoreTone } from '$lib/health/metrics.js';

	/**
	 * One number for the day, next to the page title.
	 *
	 * The ring is the whole design: a track, an arc, and the number inside it. It
	 * follows the same scrub as the charts, so hovering a day up-ends the score
	 * with it rather than leaving a second, contradictory headline on the page.
	 *
	 * The text leads and the ring sits on the outside edge of the row, so the ring
	 * lands hard against the margin on both layouts — beside the title from `md`
	 * up, and at the right edge of the column below it.
	 */
	let { score = null, counted = 0, of = 0, when = '' } = $props();

	// r=40 in an 88 box leaves room for a 6px stroke to sit inside the viewBox.
	const RADIUS = 40;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

	const fraction = $derived(score === null ? 0 : Math.max(0, Math.min(score, 100)) / 100);
	const offset = $derived(CIRCUMFERENCE * (1 - fraction));
	const label = $derived(scoreLabel(score));

	// The arc is the one thing on the page that says how the day went without
	// being read, so it carries the band's color. Everything around it stays
	// neutral — two things changing color would just be noise.
	const tone = $derived(scoreTone(score));

	// The count only earns a place when the day is short a metric — "4 of 4" on
	// every full day is noise, and it is the partial day that needs explaining.
	const caption = $derived(
		counted > 0 && counted < of ? `${when} · ${counted} of ${of} metrics` : when
	);
</script>

<div class="flex items-center justify-between gap-4 md:justify-end">
	<div class="min-w-0">
		<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{label}</p>
		<p class="text-sm text-neutral-500 tabular-nums dark:text-neutral-500">
			{caption}
		</p>
	</div>

	<div
		class="relative shrink-0"
		role="img"
		aria-label={score === null ? 'No health score yet' : `Health score ${score} out of 100`}
	>
		<svg viewBox="0 0 88 88" class="h-20 w-20 -rotate-90" aria-hidden="true">
			<circle cx="44" cy="44" r={RADIUS} fill="none" stroke="var(--chart-track)" stroke-width="6" />
			<!-- `pathLength` is left alone here: the dash math is exact, and animating
			     the offset is what makes the ring wind up on load and re-aim on scrub. -->
			<circle
				class="health-ring"
				cx="44"
				cy="44"
				r={RADIUS}
				fill="none"
				stroke={tone}
				stroke-width="6"
				stroke-linecap="round"
				stroke-dasharray={CIRCUMFERENCE}
				stroke-dashoffset={offset}
			/>
		</svg>
		<span
			class="absolute inset-0 flex items-center justify-center text-2xl font-medium tracking-tight text-neutral-900 tabular-nums dark:text-neutral-100"
		>
			{score === null ? '—' : score}
		</span>
	</div>
</div>

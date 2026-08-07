<script>
	import { createDialKit } from 'dialkit/svelte';
	import { LIFE_DEFAULTS, lifeSettings } from '$lib/error/settings.svelte.js';

	/**
	 * The error pages' tuning panel, on preview deployments only.
	 *
	 * Reached through a dynamic import behind `__DIALS__` in
	 * `ErrorDialsMount.svelte`, so a production build folds it away entirely. It
	 * registers a folder into the overlay `DialsHost` already mounted from the
	 * root layout, and disappears again when the route changes.
	 *
	 * Every value in here is a judgement about how a whole viewport reads at a
	 * glance — how fine the grid should be before it stops being a grid, how long
	 * the numeral should hold before it starts coming apart, how fast a
	 * generation can pass and still be followed. None of those are values you can
	 * reason your way to from a file; they have to be watched.
	 */

	const dials = createDialKit('Error', {
		grid: {
			cell: [LIFE_DEFAULTS.cell, 4, 28, 1],
			cellSm: [LIFE_DEFAULTS.cellSm, 3, 20, 1],
			gap: [LIFE_DEFAULTS.gap, 0, 6, 0.5],
			radius: [LIFE_DEFAULTS.radius, 0, 6, 0.5],
			opacity: [LIFE_DEFAULTS.opacity, 0, 1, 0.02]
		},
		motion: {
			stepMs: [LIFE_DEFAULTS.stepMs, 30, 500, 5],
			holdMs: [LIFE_DEFAULTS.holdMs, 0, 5000, 50],
			cycle: [LIFE_DEFAULTS.cycle, 60, 4000, 20]
		},
		shapes: {
			density: [LIFE_DEFAULTS.density, 0, 3, 0.05]
		},
		number: {
			stampHeight: [LIFE_DEFAULTS.stampHeight, 0.1, 0.9, 0.01],
			stampWidth: [LIFE_DEFAULTS.stampWidth, 0.2, 1, 0.01],
			stampCenter: [LIFE_DEFAULTS.stampCenter, 0.1, 0.9, 0.01],
			stampTracking: [LIFE_DEFAULTS.stampTracking, 0, 6, 0.1],
			stampStroke: [LIFE_DEFAULTS.stampStroke, 0.5, 5, 0.1],
			stampOutline: LIFE_DEFAULTS.stampOutline
		}
	});

	$effect(() => {
		Object.assign(lifeSettings, dials.grid, dials.motion, dials.shapes, dials.number);
	});
</script>

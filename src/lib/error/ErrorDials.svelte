<script>
	import { createDialKit } from 'dialkit/svelte';
	import { LIFE_DEFAULTS, lifeSettings } from '$lib/error/settings.svelte.js';

	/**
	 * The error pages' tuning panel, preview only. Registers a folder into the
	 * `DialsHost` mounted from the root layout, and goes with the route.
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

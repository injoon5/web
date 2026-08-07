<script>
	import { createDialKit } from 'dialkit/svelte';
	import { HOME_DEFAULTS, homeSettings } from '$lib/home/settings.svelte.js';

	/**
	 * The home page's tuning panel, on preview deployments only.
	 *
	 * Reached through a dynamic import behind `__DIALS__` in
	 * `HomeDialsMount.svelte`, so a production build folds it away entirely. It
	 * registers a folder into the overlay `DialsHost` already mounted from the
	 * root layout, and disappears again when the route changes.
	 *
	 * Both sections are images at a size, a spacing and a radius, and all three
	 * are guesses until they are seen against real album art and real photos —
	 * which is exactly what a slider is for. Nothing persists: what settles gets
	 * copied into `HOME_DEFAULTS` by hand.
	 */

	const dials = createDialKit('Home', {
		music: {
			marqueeSpeed: [HOME_DEFAULTS.marqueeSpeed, 5, 160, 1],
			coverSize: [HOME_DEFAULTS.coverSize, 5, 20, 0.25],
			coverSizeLg: [HOME_DEFAULTS.coverSizeLg, 5, 24, 0.25],
			coverGap: [HOME_DEFAULTS.coverGap, 0, 3, 0.05],
			scrim: [HOME_DEFAULTS.scrim, 0, 1, 0.02]
		},
		photos: {
			photoColumns: [HOME_DEFAULTS.photoColumns, 1, 6, 1],
			photoCount: [HOME_DEFAULTS.photoCount, 1, 18, 1],
			photoGap: [HOME_DEFAULTS.photoGap, 0, 3, 0.05]
		},
		// Shared by covers and photos on purpose: two radii that are nearly the
		// same read as a mistake, so they move together.
		shared: {
			radius: [HOME_DEFAULTS.radius, 0, 2, 0.05]
		}
	});

	$effect(() => {
		Object.assign(homeSettings, dials.music, dials.photos, dials.shared);

		// The marquee sizes its animation from scroll distance, so a speed change
		// moves no boxes and its ResizeObserver never hears about it.
		document.dispatchEvent(new Event('marquee:retune'));
	});
</script>

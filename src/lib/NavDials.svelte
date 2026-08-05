<script>
	import { createDialKit } from 'dialkit/svelte';
	import { NAV_ALIGNMENTS, NAV_DEFAULTS, navSettings } from '$lib/nav-settings.svelte.js';

	/**
	 * The header's tuning panel, on preview deployments and in `vite dev` only.
	 *
	 * Reached through a dynamic import behind `__DIALS__` in
	 * `NavDialsMount.svelte`, so a production build folds it away entirely. It
	 * registers a folder into the overlay `DialsHost` already mounted from the
	 * root layout.
	 *
	 * This is the one panel that does not come and go with the route, and it is
	 * not the site-wide panel the rest of this setup exists to avoid: that rule
	 * is about sliders for tokens the current page may not show, and every
	 * control here moves type that is on screen on every page. The disclosure
	 * folder is the exception worth knowing about — its controls do nothing above
	 * `sm`, where the row holds all four links and there is no second row to
	 * space. Narrow the window to see them work.
	 *
	 * Nothing persists. Whatever settles gets copied back into `NAV_DEFAULTS` by
	 * hand, so the shipped values stay in source, reviewed, rather than in a
	 * preview's local storage.
	 */

	const dials = createDialKit('Nav', {
		axis: {
			align: { type: 'select', options: NAV_ALIGNMENTS, default: NAV_DEFAULTS.align },
			clusterNudge: [NAV_DEFAULTS.clusterNudge, -8, 8, 0.5]
		},
		row: {
			rowPadY: [NAV_DEFAULTS.rowPadY, 0, 32, 1],
			wordGap: [NAV_DEFAULTS.wordGap, 0, 32, 1],
			toggleOverhang: [NAV_DEFAULTS.toggleOverhang, 0, 32, 0.5],
			chevronSize: [NAV_DEFAULTS.chevronSize, 10, 28, 1],
			chevronStroke: [NAV_DEFAULTS.chevronStroke, 1, 3.5, 0.05]
		},
		disclosure: {
			// Offset from the two line boxes sitting flush, which is 40px baseline to
			// baseline — so this reads -24 to +32 against a real 16 to 72. Negative
			// pulls the second line up into the first row's padding, which is empty.
			lead: [NAV_DEFAULTS.lead, -24, 32, 1],
			padBottom: [NAV_DEFAULTS.padBottom, 0, 40, 1],
			padRight: [NAV_DEFAULTS.padRight, 0, 96, 1],
			moreGap: [NAV_DEFAULTS.moreGap, 0, 32, 1]
		},
		motion: {
			_collapsed: true,
			// In px of scroll, not ms — the surface is on a scroll timeline, so this
			// one is measured against the page rather than the clock. Drag the window
			// down slowly to judge it.
			surfaceRange: [NAV_DEFAULTS.surfaceRange, 0, 240, 4],
			duration: [NAV_DEFAULTS.duration, 80, 800, 10],
			linkDuration: [NAV_DEFAULTS.linkDuration, 80, 800, 10],
			staggerBase: [NAV_DEFAULTS.staggerBase, 0, 200, 5],
			staggerStep: [NAV_DEFAULTS.staggerStep, 0, 200, 5]
		}
	});

	// One effect rather than one per key: the panel groups controls into folders
	// for layout, the header reads a flat object.
	$effect(() => {
		Object.assign(navSettings, dials.axis, dials.row, dials.disclosure, dials.motion);
	});
</script>

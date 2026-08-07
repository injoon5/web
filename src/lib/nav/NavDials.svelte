<script>
	import { createDialKit } from 'dialkit/svelte';
	import { NAV_ALIGNMENTS, NAV_DEFAULTS, navSettings } from '$lib/nav/settings.svelte.js';

	/**
	 * The header's tuning panel, preview and `vite dev` only. Registers a folder
	 * into the `DialsHost` mounted from the root layout.
	 *
	 * The one panel present on every route, and not the site-wide panel this setup
	 * exists to avoid — the header is on screen everywhere. The `disclosure`
	 * folder does nothing above `sm`, where the row holds all four links.
	 *
	 * Nothing persists; what settles is copied into `NAV_DEFAULTS` by hand.
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
			// How deep the lower lip of the wordmark's window is, in px, all of it
			// gradient. Only visible on the home page and only while the name is
			// coming through it; 12 is where it reaches the hairline, past that it
			// hangs below one.
			namePortal: [NAV_DEFAULTS.namePortal, 0, 32, 1],
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

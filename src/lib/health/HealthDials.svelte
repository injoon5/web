<script>
	import { DialRoot, createDialKit } from 'dialkit/svelte';
	import 'dialkit/styles.css';
	import {
		CHART_CURVES,
		CHART_DEFAULTS,
		CHART_VARIANTS,
		chartSettings
	} from '$lib/health/chart-settings.svelte.js';

	/**
	 * The /health tuning panel, on preview deployments only.
	 *
	 * This component is never imported statically — `HealthDialsMount.svelte`
	 * reaches it through a dynamic import behind `__HEALTH_DIALS__`, which Vite
	 * bakes in as a literal. In a production build that branch folds away, the
	 * import is unreachable, and neither DialKit nor its stylesheet is emitted.
	 *
	 * The panel writes straight into `chartSettings`, the same object the charts
	 * read, so the sliders move the real page. Nothing here persists: whatever
	 * settles gets copied back into `CHART_DEFAULTS` by hand, which is the point —
	 * the shipped values stay in source, reviewed, rather than in a preview's
	 * local storage.
	 */

	const dials = createDialKit('Health chart', {
		shape: {
			variant: { type: 'select', options: CHART_VARIANTS, default: CHART_DEFAULTS.variant },
			curve: { type: 'select', options: CHART_CURVES, default: CHART_DEFAULTS.curve },
			strokeWidth: [CHART_DEFAULTS.strokeWidth, 1, 6, 0.1],
			headroom: [CHART_DEFAULTS.headroom, 0, 0.6, 0.01]
		},
		box: {
			height: [CHART_DEFAULTS.height, 60, 260, 1],
			gutter: [CHART_DEFAULTS.gutter, 0, 72, 1],
			padY: [CHART_DEFAULTS.padY, 0, 32, 1]
		},
		axis: {
			tickCount: [CHART_DEFAULTS.tickCount, 1, 6, 1]
		},
		marker: {
			markerRadius: [CHART_DEFAULTS.markerRadius, 1, 8, 0.5]
		}
	});

	// One effect rather than one per key: the panel groups controls into folders
	// for layout, but the charts read a flat object.
	$effect(() => {
		Object.assign(chartSettings, dials.shape, dials.box, dials.axis, dials.marker);
	});
</script>

<DialRoot position="bottom-right" theme="system" />

<script>
	import { createDialKit } from 'dialkit/svelte';
	import {
		CHART_COLORS,
		CHART_CURVES,
		CHART_DEFAULTS,
		CHART_VARIANTS,
		COLOR_VARS,
		chartSettings
	} from '$lib/health/settings.svelte.js';

	/**
	 * The /health tuning panel, on preview deployments only.
	 *
	 * This component is never imported statically — `HealthDialsMount.svelte`
	 * reaches it through a dynamic import behind `__DIALS__`, which Vite
	 * bakes in as a literal. In a production build that branch folds away, the
	 * import is unreachable, and neither DialKit nor its stylesheet is emitted.
	 *
	 * It registers a panel but renders no `<DialRoot />`: the site mounts exactly
	 * one, from the root layout, and this shows up inside it as a folder that
	 * appears on /health and disappears again on the way out.
	 *
	 * Dimensions write into `chartSettings`, the object the charts read. Colours
	 * take the other route: they are already CSS custom properties, so the panel
	 * overrides those on `:root` and the components never learn about it.
	 *
	 * Nothing here persists. Whatever settles gets copied back into
	 * `CHART_DEFAULTS` or `app.css` by hand, which is the point — the shipped
	 * values stay in source, reviewed, rather than in a preview's local storage.
	 */

	const dials = createDialKit('Health chart', {
		shape: {
			variant: { type: 'select', options: CHART_VARIANTS, default: CHART_DEFAULTS.variant },
			curve: { type: 'select', options: CHART_CURVES, default: CHART_DEFAULTS.curve },
			strokeWidth: [CHART_DEFAULTS.strokeWidth, 1, 8, 0.1],
			headroom: [CHART_DEFAULTS.headroom, 0, 0.6, 0.01]
		},
		box: {
			height: [CHART_DEFAULTS.height, 60, 320, 1],
			heightSm: [CHART_DEFAULTS.heightSm, 60, 320, 1],
			gutter: [CHART_DEFAULTS.gutter, 0, 72, 1],
			padY: [CHART_DEFAULTS.padY, 0, 32, 1]
		},
		axis: {
			tickCount: [CHART_DEFAULTS.tickCount, 1, 6, 1]
		},
		marker: {
			markerRadius: [CHART_DEFAULTS.markerRadius, 1, 8, 0.5]
		},
		// Hex strings are picked up as colour wells on their own — no `type` needed.
		color: {
			_collapsed: true,
			// The wash is mixed off the accent stop by stop, so re-colouring the
			// line takes its fill with it rather than leaving an orange shadow under
			// a blue stroke. Only its strength is separately tunable.
			accent: CHART_COLORS.accent,
			washAlpha: [CHART_DEFAULTS.washAlpha, 0, 0.6, 0.01],
			axis: CHART_COLORS.axis,
			track: CHART_COLORS.track
		},
		score: {
			_collapsed: true,
			excellent: CHART_COLORS.excellent,
			good: CHART_COLORS.good,
			fair: CHART_COLORS.fair,
			light: CHART_COLORS.light
		}
	});

	// One effect rather than one per key: the panel groups controls into folders
	// for layout, but the charts read a flat object. `washAlpha` rides along from
	// the colour folder, because that is where it belongs to a person tuning it.
	$effect(() => {
		Object.assign(chartSettings, dials.shape, dials.box, dials.axis, dials.marker, {
			washAlpha: dials.color.washAlpha
		});
	});

	/**
	 * Colour overrides, written on `:root` and removed the moment a control
	 * returns to its default — so an untouched panel leaves `app.css` in charge
	 * and dark mode keeps its own palette.
	 */
	$effect(() => {
		const root = document.documentElement;
		const picked = { ...dials.color, ...dials.score };

		const apply = (prop, value, fallback) => {
			if (value && value.toLowerCase() !== fallback.toLowerCase()) {
				root.style.setProperty(prop, value);
			} else {
				root.style.removeProperty(prop);
			}
		};

		for (const [key, prop] of Object.entries(COLOR_VARS)) {
			apply(prop, picked[key], CHART_COLORS[key]);
		}

		// No wash entry: it is mixed off `--chart-accent` in the chart itself, so
		// overriding the accent above has already recoloured it.
		return () => {
			for (const prop of Object.values(COLOR_VARS)) root.style.removeProperty(prop);
		};
	});
</script>

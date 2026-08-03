<script>
	import { DialRoot, createDialKit } from 'dialkit/svelte';
	import 'dialkit/styles.css';
	import {
		CHART_COLORS,
		CHART_CURVES,
		CHART_DEFAULTS,
		CHART_VARIANTS,
		COLOR_VARS,
		WASH_OPACITY,
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
			accent: CHART_COLORS.accent,
			// The wash is derived from the accent rather than picked separately, so
			// re-colouring the line takes its fill with it instead of leaving an
			// orange shadow under a blue stroke.
			wash: [WASH_OPACITY, 0, 0.6, 0.01],
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
	// for layout, but the charts read a flat object.
	$effect(() => {
		Object.assign(chartSettings, dials.shape, dials.box, dials.axis, dials.marker);
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

		// The wash tracks the accent, so it is rewritten whenever either moves.
		const { accent, wash } = dials.color;
		if (wash !== WASH_OPACITY || accent.toLowerCase() !== CHART_COLORS.accent.toLowerCase()) {
			const fade = (alpha) => `color-mix(in oklab, ${accent}, transparent ${(1 - alpha) * 100}%)`;
			root.style.setProperty('--chart-wash-top', fade(wash));
			root.style.setProperty('--chart-wash-bottom', fade(0.02));
		} else {
			root.style.removeProperty('--chart-wash-top');
			root.style.removeProperty('--chart-wash-bottom');
		}

		return () => {
			for (const prop of Object.values(COLOR_VARS)) root.style.removeProperty(prop);
			root.style.removeProperty('--chart-wash-top');
			root.style.removeProperty('--chart-wash-bottom');
		};
	});
</script>

<!-- `productionEnabled`, because DialKit hides itself when `NODE_ENV` is
     `production` — and a Vercel preview is a production build of the app, just
     deployed somewhere else. The gate that matters is `__HEALTH_DIALS__`: if
     this component exists at all, the build already decided the panel belongs. -->
<DialRoot position="bottom-right" theme="system" productionEnabled />

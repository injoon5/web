<script>
	import { DialRoot, createDialKit } from 'dialkit/svelte';
	import 'dialkit/styles.css';

	/**
	 * The site-wide tuning panel, on preview deployments and `vite dev` only.
	 *
	 * Loaded from the root layout through `DialsMount.svelte`, so it is on every
	 * public page — home, blog, projects, an article, /now, /health. It also owns
	 * the single `<DialRoot />` for the whole app; page-level panels (see
	 * `HealthDials.svelte`) only call `createDialKit` and appear as folders here.
	 *
	 * Every control drives something the site already uses. That was the design
	 * constraint: a slider that moves an invented token is a slider that lies, so
	 * these are wired to the four levers that actually change how the site reads.
	 *
	 *   Root size   Tailwind's whole scale is in `rem`, so this is the one knob
	 *               that resizes every type step, margin and gap at once, in
	 *               proportion. It is the fastest way to find out whether the site
	 *               is set too large — which is usually the question.
	 *   Measure     `max-w-6xl` is the column the nav, the content and the footer
	 *               all share. On a site that is mostly prose, line length is the
	 *               single biggest readability lever there is.
	 *   Tracking    Letter-spacing at body size, where the variable font's default
	 *               fit is worth second-guessing.
	 *   Weight      Body weight, for the same reason.
	 *   Motion      `--motion-*` and `--ease-*` are the durations and curves the
	 *               site's transitions are written against.
	 *
	 * Nothing persists. Whatever settles gets copied into `app.css` by hand — the
	 * shipped values stay in source, reviewed, not in a preview's local storage.
	 */

	const DEFAULTS = {
		rootSize: 16,
		measure: 72,
		tracking: 0,
		weight: 400,
		fast: 120,
		base: 180,
		slow: 320
	};

	const dials = createDialKit('Site', {
		type: {
			rootSize: [DEFAULTS.rootSize, 13, 22, 0.5],
			tracking: [DEFAULTS.tracking, -0.03, 0.03, 0.002],
			weight: [DEFAULTS.weight, 300, 700, 10]
		},
		layout: {
			measure: [DEFAULTS.measure, 40, 96, 0.5]
		},
		motion: {
			_collapsed: true,
			fast: [DEFAULTS.fast, 0, 400, 10],
			base: [DEFAULTS.base, 0, 600, 10],
			slow: [DEFAULTS.slow, 0, 900, 10]
		}
	});

	/**
	 * Written as custom properties on `:root`, and removed the moment a control
	 * returns to its default — so an untouched panel leaves `app.css` in charge
	 * rather than pinning every value to whatever this file happens to say.
	 */
	$effect(() => {
		const root = document.documentElement;
		const { type, layout, motion } = dials;

		const apply = (prop, value, fallback, unit = '') => {
			if (value === fallback) root.style.removeProperty(prop);
			else root.style.setProperty(prop, `${value}${unit}`);
		};

		apply('--site-root-size', type.rootSize, DEFAULTS.rootSize, 'px');
		apply('--site-tracking', type.tracking, DEFAULTS.tracking, 'em');
		apply('--site-weight', type.weight, DEFAULTS.weight);
		apply('--site-measure', layout.measure, DEFAULTS.measure, 'rem');
		apply('--motion-fast', motion.fast, DEFAULTS.fast, 'ms');
		apply('--motion-base', motion.base, DEFAULTS.base, 'ms');
		apply('--motion-slow', motion.slow, DEFAULTS.slow, 'ms');

		return () => {
			for (const prop of [
				'--site-root-size',
				'--site-tracking',
				'--site-weight',
				'--site-measure',
				'--motion-fast',
				'--motion-base',
				'--motion-slow'
			]) {
				root.style.removeProperty(prop);
			}
		};
	});
</script>

<!-- The rules the type and layout dials act through, injected here rather than
     shipped in `app.css`: they exist only in the builds that load this file, and
     every one falls back to the value the site already had, so an untouched
     panel changes nothing. Unlayered on purpose — that is what lets the measure
     rule outrank Tailwind's own `.max-w-6xl` in `@layer utilities`. -->
<svelte:head>
	<style>
		html {
			font-size: var(--site-root-size, 16px);
		}
		body {
			letter-spacing: var(--site-tracking, normal);
			font-weight: var(--site-weight, 400);
		}
		.max-w-6xl {
			max-width: var(--site-measure, 72rem);
		}
	</style>
</svelte:head>

<!-- `productionEnabled`, because DialKit hides itself when `NODE_ENV` is
     `production` — and a Vercel preview is a production build of the app, just
     deployed somewhere else. The gate that matters is `__DIALS__`: if this
     component exists at all, the build already decided the panel belongs. -->
<DialRoot position="bottom-right" theme="system" productionEnabled />

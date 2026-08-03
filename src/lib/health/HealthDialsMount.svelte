<script>
	/**
	 * The seam that keeps DialKit out of production.
	 *
	 * `__HEALTH_DIALS__` is a literal baked in by `vite.config.ts` — true on
	 * preview deployments and `vite dev`, false everywhere else. Because it is a
	 * literal and not an env read, Rollup folds this to `if (false)` in a
	 * production build, the `import()` below becomes unreachable, and no chunk is
	 * emitted for DialKit, its stylesheet, or the panel that uses them.
	 *
	 * The import is dynamic and client-side for the same reason it is guarded: the
	 * panel is a browser-only overlay, and loading it must not block the page it
	 * is meant to be tuning.
	 */
	let Dials = $state(null);

	$effect(() => {
		if (!__HEALTH_DIALS__) return;
		import('$lib/health/HealthDials.svelte').then((module) => {
			Dials = module.default;
		});
	});
</script>

{#if Dials}
	<Dials />
{/if}

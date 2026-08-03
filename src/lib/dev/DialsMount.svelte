<script>
	/**
	 * The seam that keeps DialKit out of production, and the only place the panel
	 * is mounted for the site as a whole.
	 *
	 * `__DIALS__` is a literal baked in by `vite.config.ts` — true on preview
	 * deployments and `vite dev`, false everywhere else. Because it is a literal
	 * and not an env read, Rollup folds this to `if (false)` in a production
	 * build, the `import()` below becomes unreachable, and no chunk is emitted for
	 * DialKit, its stylesheet, or the panel that uses them.
	 *
	 * The import is dynamic and client-side for the same reason it is guarded: the
	 * panel is a browser-only overlay, and loading it must not block the page it
	 * is meant to be tuning.
	 *
	 * Rendered once, from the root layout, so every public page has it. Page-level
	 * panels register themselves as folders inside this one — see
	 * `HealthDials.svelte`.
	 */
	let Dials = $state(null);

	$effect(() => {
		if (!__DIALS__) return;
		import('$lib/dev/SiteDials.svelte').then((module) => {
			Dials = module.default;
		});
	});
</script>

{#if Dials}
	<Dials />
{/if}

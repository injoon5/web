<script>
	/**
	 * The seam that keeps DialKit out of production for the home page.
	 *
	 * `__DIALS__` is a literal baked in by `vite.config.ts` — true on preview
	 * deployments and `vite dev`, false everywhere else. Because it is a literal
	 * and not an env read, Rollup folds this to `if (false)` in a production
	 * build and the `import()` below becomes unreachable, so no chunk is emitted.
	 *
	 * The guard and the import have to stay in the same place for that to work:
	 * hand the import to a helper and Rollup can no longer prove it is never
	 * called, and the chunk ships.
	 */
	let Panel = $state(null);

	$effect(() => {
		if (!__DIALS__) return;
		import('$lib/home/HomeDials.svelte').then((module) => {
			Panel = module.default;
		});
	});
</script>

{#if Panel}
	<Panel />
{/if}

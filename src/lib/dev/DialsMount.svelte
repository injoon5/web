<script>
	// `__DIALS__` is a build-time literal, so this folds to `if (false)` in
	// production and no DialKit chunk is emitted. The guard and the import() have
	// to stay together for that — see CLAUDE.md.
	let Dials = $state(null);

	$effect(() => {
		if (!__DIALS__) return;
		import('$lib/dev/DialsHost.svelte').then((module) => {
			Dials = module.default;
		});
	});
</script>

{#if Dials}
	<Dials />
{/if}

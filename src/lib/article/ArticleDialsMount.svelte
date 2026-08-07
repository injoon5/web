<script>
	// `__DIALS__` is a build-time literal, so this folds to `if (false)` in
	// production and no DialKit chunk is emitted. The guard and the import() have
	// to stay together for that — see CLAUDE.md.
	let Panel = $state(null);

	$effect(() => {
		if (!__DIALS__) return;
		import('$lib/article/ArticleDials.svelte').then((module) => {
			Panel = module.default;
		});
	});
</script>

{#if Panel}
	<Panel />
{/if}

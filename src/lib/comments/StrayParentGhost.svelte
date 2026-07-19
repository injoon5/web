<script>
	// Placeholder card for a hard-deleted parent whose replies are still shown.
	let { admin = false } = $props();
</script>

<div
	class="p-4 {admin
		? 'rounded-lg border border-neutral-200 bg-neutral-100 opacity-70 dark:border-neutral-800 dark:bg-neutral-900'
		: 'rounded-xl border border-dashed border-neutral-300/80 opacity-80 dark:border-neutral-700/80'}"
>
	<p class="font-semibold text-neutral-400 italic dark:text-neutral-600">[deleted]</p>
	<p class="mt-1 text-sm text-neutral-400 italic dark:text-neutral-600">[deleted]</p>
</div>

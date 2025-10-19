<script>
import { page } from "$app/stores";
</script>

<svelte:head>
	<title>{$page.status} — Error</title>
</svelte:head>

<section class="my-32 flex items-center justify-center">
	<div class="text-center">
		<p
			class=" text-7xl font-semibold uppercase tracking-tight text-neutral-900 dark:text-neutral-100"
		>
			{$page.status}
		</p>
		<h1 class="mt-3 text-3xl font-bold tracking-tight text-neutral-500 dark:text-neutral-500">
			Something went wrong
		</h1>
		{#if $page.error?.message}
			<p
				class="mx-auto mt-4 max-w-xl text-xl font-medium tracking-tight text-neutral-400 dark:text-neutral-600"
			>
				{$page.error.message}
			</p>
		{/if}

		<div class="mt-8 flex justify-center gap-3">
			<a
				href="/"
				class="inline-flex items-center px-4 py-2 text-lg font-medium text-neutral-900 hover:text-neutral-500 dark:text-neutral-100 dark:hover:text-neutral-400"
			>
				Go home
			</a>
		</div>
	</div>
</section>

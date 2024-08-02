<script>
	import { onMount } from 'svelte';
	import '../app.css';
	import { page, navigating } from '$app/stores';
	// import NavBar from '$lib/NavBar.svelte';
	import NavBar from '$lib/NavBar.svelte';

	
	import { inject } from '@vercel/analytics'
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	inject();
	injectSpeedInsights();
</script>

<nav class="mx-auto max-w-xl px-3 pt-4 text-sm">
	<NavBar />
</nav>

<div class="mx-auto max-w-xl px-4 pt-4 text-sm pb-4">
	<slot />
</div>

<footer>
	<div class="bg-gray-100 dark:border-t-gray-800 border-t p-4 text-xs dark:bg-[#0C0B09]">
		<div
			class="text-gray-500 dark:text-gray-400 mx-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-2"
		>
			<div>© 2024 Injoon Oh</div>
			<div>Made w/ ♥️ in Seoul, South Korea</div>
		</div>
	</div>
</footer>

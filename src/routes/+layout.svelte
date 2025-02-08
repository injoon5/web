<script>
	import '../app.css';
	// import NavBar from '$lib/NavBar.svelte';
	import NavBar from '$lib/NavBar.svelte';

	import { inject } from '@vercel/analytics';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	inject();
	injectSpeedInsights();
</script>

<svelte:head>
	<link rel="canonical" href="https://www.injoon5.com" />
	<script
		defer
		src="https://analytics.injoon5.com/script.js"
		data-website-id="59821eb1-0b3c-40eb-b21f-4fd98040b47b"
	></script>
</svelte:head>

<nav class="mx-auto max-w-xl px-3 pt-4 text-sm">
	<NavBar />
</nav>

<div class="mx-auto max-w-xl px-4 pb-4 pt-4 text-sm">
	<slot />
</div>

<footer class="mt-auto w-full bg-gray-100 dark:bg-[#0C0B09]">
	<div class="border-t p-4 text-xs dark:border-t-gray-800">
		<div
			class="mx-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-2 text-gray-500 dark:text-gray-400"
		>
			<div>© 2024 Injoon Oh</div>
			<div>Made w/ ♥️ in Seoul, South Korea</div>
		</div>
	</div>
</footer>

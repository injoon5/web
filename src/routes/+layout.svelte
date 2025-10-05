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

<nav class="sticky top-0 z-30 mx-auto max-w-6xl bg-white px-4 py-3 text-sm sm:px-12 dark:bg-black">
	<NavBar />
</nav>

<div class="mx-auto max-w-6xl px-4 pb-4 pt-4 text-sm sm:px-12">
	<slot />
</div>

<footer class="mb-20 mt-10 w-full">
	<div class="text-xs">
		<div
			class="mx-auto grid max-w-6xl grid-cols-12 items-start gap-4 px-4 text-base font-semibold text-neutral-600 sm:px-12 dark:text-neutral-400"
		>
			<div class="col-span-12 sm:col-span-6 lg:col-span-2">
				<p class="text-neutral-900 dark:text-neutral-100">Injoon Oh</p>
				<a href="mailto:me@injoon5.com" class=" hover:text-neutral-900 dark:hover:text-neutral-100"
					>me@injoon5.com</a
				>
				<br />
				<a
					href="https://github.com/injoon5"
					class=" hover:text-neutral-900 dark:hover:text-neutral-100">@injoon5 (GitHub)</a
				>
				<br />

				<a
					href="https://x.com/injoon_oh"
					class=" hover:text-neutral-900 dark:hover:text-neutral-100">@injoon_oh (Twitter)</a
				>
			</div>
			<div class="col-span-12 sm:col-span-6 lg:col-span-5">
				<p class="text-neutral-900 dark:text-neutral-100">Made in</p>
				<p class="text-neutral-900 dark:text-neutral-100">Seoul, South Korea</p>
				<p>New York, New York, USA</p>
				<p>San Francisco, California, USA</p>
				<p>Tokyo, Japan</p>
			</div>
			<div
				class="col-span-12 flex hover:text-neutral-900 md:col-span-6 lg:col-span-5 lg:justify-end dark:hover:text-neutral-100 mt-10 lg:mt-0"
			>
				
				<button
					on:click={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
					aria-label="Scroll to top"
				>
					Scroll to top
				</button>
			</div>
			<div class="col-span-12 lg:mt-10">
				<p class="text-neutral-900 dark:text-neutral-100">Copyright © 2025 Injoon Oh</p>
			</div>
		</div>
	</div>
</footer>

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

<nav class="sticky top-0 z-30 mx-auto max-w-6xl px-4 sm:px-12 py-3 text-sm bg-white dark:bg-black">
	<NavBar />
</nav>

<div class="mx-auto max-w-6xl px-4 sm:px-12 pb-4 pt-4 text-sm">
	<slot />
</div>

<footer class="mt-10 mb-20 w-full">
	<div class="text-xs">
		<div class="mx-auto max-w-6xl px-4 sm:px-12 grid grid-cols-12 items-start gap-4 text-neutral-600 dark:text-neutral-400 text-base font-semibold">
			<div class="col-span-12 md:col-span-6 lg:col-span-2">
				<p class="text-black dark:text-white">Injoon Oh</p>
				<a href="mailto:me@injoon5.com" class=" hover:text-black dark:hover:text-white">me@injoon5.com</a>
				<br />
				<a href="https://github.com/injoon5" class=" hover:text-black dark:hover:text-white">@injoon5 (GitHub)</a>
				<br />
				
				<a href="https://x.com/injoon_oh" class=" hover:text-black dark:hover:text-white">@injoon_oh (X)</a>
			</div>
			<div class="col-span-12 md:col-span-6 lg:col-span-5 ">
				<p class="text-black dark:text-white">Made in</p>
				<p class="text-black dark:text-white">Seoul, South Korea</p>
				<p>New York, New York, USA</p>
				<p>San Francisco, California, USA</p>
				<p>Tokyo, Japan</p>
			</div>
			<div class="col-span-12 md:col-span-6 lg:col-span-5 flex lg:justify-end hover:text-black dark:hover:text-white">
				<button
					on:click={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
					aria-label="Scroll to top"
				>
					Scroll to top
				</button>
			</div>
		</div>
	</div>
</footer>

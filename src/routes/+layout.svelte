<script>
	import '../app.css';
	import NavBar from '$lib/NavBar.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { configure } from 'onedollarstats';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { page } from '$app/stores';
	import { setupConvex } from 'convex-svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { theme } from '$lib/theme.js';
	import { env as publicEnv } from '$env/dynamic/public';

	const commit = publicEnv.PUBLIC_GIT_COMMIT ?? '';
	const commitDate = (() => {
		const raw = publicEnv.PUBLIC_GIT_COMMIT_DATE;
		if (!raw) return '';
		try {
			return new Intl.DateTimeFormat('en', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			}).format(new Date(raw));
		} catch {
			return '';
		}
	})();

	setupConvex(PUBLIC_CONVEX_URL);

	const { trigger, destroy } = createWebHaptics();
	onDestroy(destroy);

	const SCROLL_DURATION = 500;

	function scrollToTop() {
		const start = window.scrollY;
		const startTime = performance.now();

		function step(currentTime) {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / SCROLL_DURATION, 1);
			const ease =
				progress < 0.5
					? 4 * progress * progress * progress
					: 1 - Math.pow(-2 * progress + 2, 3) / 2;
			window.scrollTo(0, start * (1 - ease));
			if (progress < 1) requestAnimationFrame(step);
		}

		requestAnimationFrame(step);
	}

	let cleanupTheme;
	let scrolled = false;

	function onScroll() {
		scrolled = window.scrollY > 8;
	}

	onMount(async () => {
		configure({
			collectorUrl: 'https://collector.onedollarstats.com/events',
			autocollect: true
		});
		cleanupTheme = theme.syncWithOS();
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
	});

	onDestroy(() => {
		cleanupTheme?.();
		if (typeof window !== 'undefined') window.removeEventListener('scroll', onScroll);
	});
</script>

<svelte:head>
	<link rel="canonical" href="https://www.injoon5.com{$page.url.pathname}" />
	<meta property="og:site_name" content="Injoon Oh" />
</svelte:head>

<div class="sticky top-0 z-30 transition-colors duration-200">
	<div
		aria-hidden="true"
		class="absolute inset-0 -z-10 backdrop-blur-md transition-colors duration-200
		{scrolled ? 'bg-white/70 dark:bg-neutral-950/70' : 'bg-white/0 dark:bg-neutral-950/0'}"
	></div>
	<div
		aria-hidden="true"
		class="absolute inset-x-0 bottom-0 h-px transition-opacity duration-200
		{scrolled ? 'opacity-100' : 'opacity-0'} bg-neutral-200/70 dark:bg-neutral-800/70"
	></div>
	<nav class="mx-auto max-w-6xl px-4 py-3 text-sm sm:px-12">
		<NavBar />
	</nav>
</div>

<div class="mx-auto max-w-6xl px-4 pt-4 pb-4 text-sm sm:px-12">
	<slot />
</div>

<footer class="mt-10 mb-20 w-full pt-24 tracking-tight">
	<div class="text-xs">
		<div
			class="mx-auto grid max-w-6xl grid-cols-12 items-start gap-4 px-4 text-base font-semibold text-neutral-500 sm:px-12 dark:text-neutral-500"
		>
			<div class="col-span-12 sm:col-span-6 lg:col-span-2">
				<p class="text-neutral-900 dark:text-neutral-100">Injoon Oh</p>
				<a href="mailto:me@injoon5.com" class=" hover:text-neutral-900 dark:hover:text-neutral-100"
					>me@injoon5.com</a
				>
				<br />
				<a
					href="https://github.com/injoon5"
					class=" hover:text-neutral-900 dark:hover:text-neutral-100">injoon5 (GitHub)</a
				>
				<br />
				<a href="/internal/rss.xml" class=" hover:text-neutral-900 dark:hover:text-neutral-100"
					>RSS Feed</a
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
				class="col-span-12 mt-10 flex hover:text-neutral-900 md:col-span-6 lg:col-span-5 lg:mt-0 lg:justify-end dark:hover:text-neutral-100"
			>
				<button
					on:click={() => {
						trigger([{ duration: SCROLL_DURATION }], { intensity: 1 });
						scrollToTop();
					}}
					aria-label="Scroll to top"
				>
					Scroll to top
				</button>
			</div>
			<div class="col-span-12 lg:mt-10">
				<p class="text-neutral-900 dark:text-neutral-100">Copyright © 2026 Injoon Oh</p>
				{#if commit}
					<p class="tabular mt-1 text-xs font-normal text-neutral-400 dark:text-neutral-600">
						Built from
						<a
							href="https://github.com/injoon5/web/commit/{commit}"
							class="font-mono hover:text-neutral-700 dark:hover:text-neutral-300"
							rel="noopener noreferrer"
							target="_blank">{commit}</a
						>{#if commitDate}<span> · {commitDate}</span>{/if}
					</p>
				{/if}
			</div>
		</div>
	</div>
</footer>

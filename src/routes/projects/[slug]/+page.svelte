<script>
	import LikeButton from '$lib/LikeButton.svelte';
	import { page } from '$app/stores';
	import { lightboxAction } from '$lib/lightbox.js';
	import Lightbox from '../../../lib/Lightbox.svelte';

	import { onMount, tick } from 'svelte';

	export let data;

	let lang = data.availableLangs[0] ?? 'en';

	$: currentMeta = (lang === 'ko' && data.koMeta) ? data.koMeta : (data.enMeta ?? data.meta);
	$: currentContent = (lang === 'ko' && data.koContent) ? data.koContent : data.enContent;
	$: currentReadingTime = (lang === 'ko' && data.koReadingTime) ? data.koReadingTime : data.enReadingTime;
	$: ogImageUrl = `https://og.ij5.dev/api/og/?title=${encodeURIComponent(data.meta.title)}&subheading=Injoon+Oh`;

	// Animated language toggle pill
	/** @type {Record<string, HTMLButtonElement>} */
	let langButtons = {};
	let pillStyle = '';
	async function updatePill() {
		await tick();
		const el = langButtons[lang];
		if (!el) return;
		const parent = el.parentElement;
		if (!parent) return;
		const parentRect = parent.getBoundingClientRect();
		const rect = el.getBoundingClientRect();
		pillStyle = `transform: translateX(${rect.left - parentRect.left}px); width: ${rect.width}px; opacity: 1;`;
	}
	$: lang, updatePill();
	onMount(() => {
		updatePill();
		const ro = new ResizeObserver(updatePill);
		const container = Object.values(langButtons)[0]?.parentElement;
		if (container) ro.observe(container);
		return () => ro.disconnect();
	});
</script>

<svelte:head>
	<title>{data.meta.title}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={data.meta.title} />
	<meta property="og:description" content={currentMeta.description ?? ''} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:url" content="https://www.injoon5.com/projects/{$page.params.slug}" />
</svelte:head>

<Lightbox />

<div class="grid grid-cols-1 gap-4 md:grid-cols-12">
	<article class="col-span-1 justify-center pt-10 md:col-span-10 md:col-start-2 lg:col-span-8 lg:col-start-3">		<div class="tracking-tight">
			<h1 class="text-3xl font-semibold tracking-tight md:font-semibold">
				{currentMeta.title}
			</h1>
			<div class="mt-1 flex flex-row items-center text-2xl font-medium text-neutral-600 dark:text-neutral-400">
				<p class="tabular">{currentMeta.year}</p>
				<p class="mx-1">·</p>
				<span class="tabular">{currentReadingTime}</span>
			</div>
			{#if data.availableLangs.length > 1}
				<div
					class="relative mt-3 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100/60 p-1 dark:border-neutral-800 dark:bg-neutral-900/60"
				>
					<span
						class="nav-indicator pointer-events-none absolute top-1 bottom-1 left-0 rounded-full bg-neutral-900 dark:bg-neutral-100"
						style={pillStyle || 'opacity:0;'}
						aria-hidden="true"
					></span>
					{#each data.availableLangs as l}
						<button
							bind:this={langButtons[l]}
							on:click={() => (lang = l)}
							class="relative z-10 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 {lang === l
								? 'text-white dark:text-neutral-900'
								: 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'}"
						>
							{l === 'en' ? 'English' : '한국어'}
						</button>
					{/each}
				</div>
			{/if}
			<p class="mt-3 text-2xl leading-tight font-medium text-neutral-500 dark:text-neutral-500">
				{currentMeta.description}
			</p>
			<div class="mt-3 flex flex-wrap items-center gap-1.5">
				<span class="text-xs font-medium tracking-widest uppercase text-neutral-400 dark:text-neutral-600">
					Stack
				</span>
				{#each currentMeta.tags as tag}
					<span
						class="inline-flex items-center rounded-full border border-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"
					>
						{tag}
					</span>
				{/each}
			</div>
			<div class="my-4">
				<LikeButton />
			</div>
		</div>
		<div
			use:lightboxAction
			class="prose-post mt-10"
		>
			{#if currentContent}
				<svelte:component this={currentContent} class="prose" />
			{/if}
		</div>
	</article>
</div>

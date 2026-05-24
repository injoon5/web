<script>
	import { formatDate } from '$lib/utils';
	import SeriesList from '$lib/SeriesList.svelte';
	import CommentsSection from '$lib/comments/CommentsSection.svelte';
	import LikeButton from '$lib/LikeButton.svelte';
	import { page } from '$app/stores';
	import Lightbox from '../../../lib/Lightbox.svelte';
	import { lightboxAction } from '$lib/lightbox.js';
	import TableOfContents from '$lib/TableOfContents.svelte';
	import Languages from '@lucide/svelte/icons/languages';
	import NumberFlow from '@number-flow/svelte';

	import { onMount, tick } from 'svelte';
	import { fly, blur } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	export let data;

	let lang = data.availableLangs[0] ?? 'ko';

	// Direction of the language swap, used to slide content the right way.
	let dir = 1;
	let reduceMotion = false;

	onMount(() => {
		const saved = localStorage.getItem('preferred-lang');
		if (saved && data.availableLangs.includes(saved)) lang = saved;
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	});

	function setLang(l) {
		if (l === lang) return;
		dir = data.availableLangs.indexOf(l) >= data.availableLangs.indexOf(lang) ? 1 : -1;
		lang = l;
		localStorage.setItem('preferred-lang', l);
	}

	let bodyWidth = 0;

	$: bannerFly = { y: -16, opacity: 0, duration: reduceMotion ? 0 : 360, easing: cubicOut };
	$: titleBlur = { amount: 8, opacity: 0, duration: reduceMotion ? 0 : 420, easing: cubicOut };
	// Both directions share duration + easing so the panels stay a constant gap apart while sliding.
	$: bodyIn = { x: dir * (bodyWidth + 32), opacity: 1, duration: reduceMotion ? 0 : 440, easing: cubicOut };
	$: bodyOut = { x: -dir * (bodyWidth + 32), opacity: 1, duration: reduceMotion ? 0 : 440, easing: cubicOut };

	$: currentMeta = (lang === 'ko' && data.koMeta) ? data.koMeta : (data.enMeta ?? data.meta);
	$: currentContent = (lang === 'ko' && data.koContent) ? data.koContent : data.enContent;
	$: currentReadingTime = (lang === 'ko' && data.koReadingTime) ? data.koReadingTime : data.enReadingTime;
	$: readingMinutes = parseInt(currentReadingTime ?? '', 10);
	$: currentSeries = lang === 'ko' ? data.koSeries : data.enSeries;
	$: ogImageUrl = `https://og.ij5.dev/api/og/?title=${encodeURIComponent(data.meta.title)}&subheading=Injoon+Oh`;

	// Animated language toggle — measure each button's rect to slide a pill behind the active one.
	/** @type {Record<string, HTMLButtonElement>} */
	let langButtons = {};
	let pillStyle = '';
	let clipStyle = '';
	async function updatePill() {
		await tick();
		const el = langButtons[lang];
		if (!el) return;
		const parent = el.parentElement;
		if (!parent) return;
		const parentRect = parent.getBoundingClientRect();
		const rect = el.getBoundingClientRect();
		const left = rect.left - parentRect.left;
		const right = parentRect.width - (left + rect.width);
		pillStyle = `transform: translateX(${left}px); width: ${rect.width}px; opacity: 1;`;
		clipStyle = `clip-path: inset(4px ${right}px 4px ${left}px round 9999px); opacity: 1;`;
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

<!-- SEO -->
<svelte:head>
	<title>{data.meta.title}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={data.meta.title} />
	<meta property="og:description" content={data.meta.description ?? ''} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:url" content="https://www.injoon5.com/blog/{$page.params.slug}" />
</svelte:head>

<Lightbox />

<div class="grid grid-cols-1 gap-4 md:grid-cols-12">
	<article class="col-span-1 justify-center pt-10 md:col-span-10 md:col-start-2 lg:col-span-8 lg:col-start-3">
		<!-- Title -->
		<div class="tracking-tight">
			{#if currentSeries?.[0]?.series}
				<div class="grid">
					{#key lang}
						<h2
							style="grid-area: 1 / 1;"
							in:blur={titleBlur}
							out:blur={titleBlur}
							class="text-xl font-medium text-neutral-500 dark:text-neutral-500"
						>
							{currentSeries[0].series}
						</h2>
					{/key}
				</div>
			{/if}
			<div class="grid">
				{#key lang}
					<h1
						style="grid-area: 1 / 1;"
						in:blur={titleBlur}
						out:blur={titleBlur}
						class="text-3xl font-semibold tracking-tight md:font-semibold"
					>
						{currentMeta.title}
					</h1>
				{/key}
			</div>
			<div class="mt-1 flex flex-row items-center text-xl font-medium text-neutral-600 dark:text-neutral-400">
				<div class="grid">
					{#key lang}
						<p style="grid-area: 1 / 1;" in:blur={titleBlur} out:blur={titleBlur} class="tabular">
							{formatDate(currentMeta.date)}
						</p>
					{/key}
				</div>
				{#if !isNaN(readingMinutes)}
					<p class="mx-1">·</p>
					<span class="tabular"><NumberFlow value={readingMinutes} /> min read</span>
				{/if}
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
							on:click={() => setLang(l)}
							class="relative z-10 rounded-full px-3 {l === 'en' ? 'mr-0.5' : ''} py-1 text-sm font-semibold text-neutral-500 transition-colors duration-150 hover:text-neutral-900 dark:hover:text-neutral-100"
						>
							{l === 'en' ? 'English' : '한국어'}
						</button>
					{/each}
					<div
						class="nav-clip pointer-events-none absolute inset-0 z-20 flex items-center gap-1 p-1"
						style={clipStyle || 'clip-path: inset(4px 100% 4px 0 round 9999px);'}
						aria-hidden="true"
					>
						{#each data.availableLangs as l}
							<span
								class="rounded-full px-3 {l === 'en' ? 'mr-0.5' : ''} py-1 text-sm font-semibold text-white dark:text-neutral-900"
							>
								{l === 'en' ? 'English' : '한국어'}
							</span>
						{/each}
					</div>
				</div>
			{/if}
			<div class="my-4">
				<LikeButton />
			</div>
			{#if currentSeries?.length > 1 && currentMeta?.series != undefined}
				<div class="my-4">
					<SeriesList series={currentSeries} />
				</div>
			{/if}
		</div>

		<!-- Post -->
		{#if currentMeta?.aiTranslated}
			<div
				transition:fly={bannerFly}
				class="mt-10 flex items-start gap-3 border-l-2 border-amber-400/80 bg-amber-100/40 px-4 py-3 dark:border-amber-500/60 dark:bg-amber-950/20"
			>
				<Languages
					size="16"
					strokeWidth="2"
					class="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
					aria-hidden="true"
				/>
				<div>
					{#if lang === 'ko'}
						<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">AI 번역</p>
						<p class="text-sm text-neutral-500 dark:text-neutral-500">
							이 글은 AI의 도움을 받아 번역되었습니다. 일부 내용에 오류가 있을 수 있습니다. 
						</p>
					{:else}
						<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">AI Translation</p>
						<p class="text-sm text-neutral-500 dark:text-neutral-500">
							This post was translated from Korean with the help of AI. Some nuance may be lost.
						</p>
					{/if}
				</div>
			</div>
		{/if}
		<div class="mt-10 grid overflow-hidden" bind:clientWidth={bodyWidth}>
			{#key lang}
				<div style="grid-area: 1 / 1;" use:lightboxAction class="prose-post" in:fly={bodyIn} out:fly={bodyOut}>
					{#if currentContent}
						<svelte:component this={currentContent} class="prose" />
					{/if}
				</div>
			{/key}
		</div>

		<div class="my-10">
			<CommentsSection />
		</div>
	</article>
</div>

<script>
	import { formatDate } from '$lib/utils';
	import SeriesList from '$lib/SeriesList.svelte';
	import CommentsSection from '$lib/comments/CommentsSection.svelte';
	import LikeButton from '$lib/LikeButton.svelte';
	import { page } from '$app/stores';
	import Lightbox from '$lib/Lightbox.svelte';
	import { lightboxAction } from '$lib/lightbox.js';
	import TableOfContents from '$lib/TableOfContents.svelte';

	import { onMount } from 'svelte';

	export let data;

	let lang = data.availableLangs[0] ?? 'ko';

	onMount(() => {
		const saved = localStorage.getItem('preferred-lang');
		if (saved && data.availableLangs.includes(saved)) lang = saved;
	});

	function setLang(l) {
		lang = l;
		localStorage.setItem('preferred-lang', l);
	}

	$: currentMeta = (lang === 'ko' && data.koMeta) ? data.koMeta : (data.enMeta ?? data.meta);
	$: currentContent = (lang === 'ko' && data.koContent) ? data.koContent : data.enContent;
	$: currentReadingTime = (lang === 'ko' && data.koReadingTime) ? data.koReadingTime : data.enReadingTime;
	$: currentSeries = lang === 'ko' ? data.koSeries : data.enSeries;
	$: ogImageUrl = `https://og.ij5.dev/api/og/?title=${encodeURIComponent(data.meta.title)}&subheading=Injoon+Oh`;
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

<div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
	<article class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
		<!-- Title -->
		<div class="tracking-tight">
			{#if currentSeries?.[0]?.series}
				<h2 class="text-xl font-medium text-neutral-500 dark:text-neutral-500">
					{currentSeries[0].series}
				</h2>
			{/if}
			<h1 class="text-3xl font-semibold tracking-tight md:font-semibold">
				{currentMeta.title}
			</h1>
			<div class="mt-1 flex flex-row text-xl font-medium text-neutral-600 dark:text-neutral-400">
				<p>{formatDate(currentMeta.date)}</p>
				<p class="mx-1">·</p>
				<p>{currentReadingTime}</p>
			</div>
			{#if data.availableLangs.length > 1}
				<div class="mt-2 flex items-center gap-1">
					{#each data.availableLangs as l}
						<button
							on:click={() => setLang(l)}
							class="rounded px-2 py-0.5 text-sm font-semibold transition-colors {lang === l
								? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
								: 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'}"
						>
							{l === 'en' ? 'English' : '한국어'}
						</button>
					{/each}
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
			<div class="mt-10 bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
				{#if lang === 'ko'}
					<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">AI 번역</p>
					<p class="text-sm text-neutral-500 dark:text-neutral-500">이 글은 AI의 도움을 받아 번역되었습니다. 일부 뉘앙스가 달라질 수 있습니다.</p>
				{:else}
					<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">AI Translation</p>
					<p class="text-sm text-neutral-500 dark:text-neutral-500">This post was translated from Korean with the help of AI. Some nuance may be lost.</p>
				{/if}
			</div>
		{/if}
		<div
			use:lightboxAction
			class="prose-img:-pt-10 prose-em:-pt-20 prose prose-neutral dark:prose-invert prose-p:text-neutral-900 dark:prose-p:text-neutral-100 prose-h1:font-semibold prose-h1:text-3xl prose-h1:tracking-tight prose-h2:font-semibold prose-h2:tracking-tight prose-a:no-underline prose-a:hover:underline prose-img:mx-auto prose-img:cursor-zoom-in mt-10 max-w-none"
		>
			{#if currentContent}
				<svelte:component this={currentContent} class="prose" />
			{/if}
		</div>

		<div class="my-10">
			<CommentsSection />
		</div>
	</article>

	<!-- TOC sidebar: only visible at xl+ in the right margin columns -->
	<aside class="hidden xl:block xl:col-span-2 xl:col-start-1 xl:row-start-1 xl:pt-14">
		<TableOfContents />
	</aside>
</div>

<script>
	import LikeButton from '$lib/LikeButton.svelte';
	import { page } from '$app/stores';
	import { lightboxAction } from '$lib/lightbox.js';
	import Lightbox from '../../../lib/Lightbox.svelte';
	import Languages from '@lucide/svelte/icons/languages';

	import { onMount, tick } from 'svelte';

	export let data;

	let lang = data.availableLangs[0] ?? 'en';

	$: currentMeta = lang === 'ko' && data.koMeta ? data.koMeta : (data.enMeta ?? data.meta);
	$: currentContent = lang === 'ko' && data.koContent ? data.koContent : data.enContent;
	$: currentReadingTime =
		lang === 'ko' && data.koReadingTime ? data.koReadingTime : data.enReadingTime;
	$: ogImageUrl = `https://www.injoon5.com/api/og?template=project&title=${encodeURIComponent(data.meta.title)}&description=${encodeURIComponent(data.meta.description || '')}&year=${encodeURIComponent(data.meta.year || '')}&tags=${encodeURIComponent((data.meta.tags || []).join(','))}`;

	// Animated language toggle pill
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
	$: (lang, updatePill());
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
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={ogImageUrl} />
	<meta property="og:url" content="https://www.injoon5.com/projects/{$page.params.slug}" />
</svelte:head>

<Lightbox />

<div class="grid grid-cols-1 gap-4 md:grid-cols-12">
	<article
		class="col-span-1 justify-center pt-10 md:col-span-10 md:col-start-2 lg:col-span-8 lg:col-start-3"
	>
		<div class="tracking-tight">
			<h1 class="text-3xl font-semibold tracking-tight md:font-semibold">
				{currentMeta.title}
			</h1>
			<div
				class="mt-1 flex flex-row items-center text-2xl font-medium text-neutral-600 dark:text-neutral-400"
			>
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
							class="relative z-10 rounded-full px-3 py-1 text-xs font-semibold text-neutral-500 transition-colors duration-150 hover:text-neutral-900 dark:hover:text-neutral-100"
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
								class="rounded-full px-3 py-1 text-xs font-semibold text-white dark:text-neutral-900"
							>
								{l === 'en' ? 'English' : '한국어'}
							</span>
						{/each}
					</div>
				</div>
			{/if}
			<p class="mt-3 text-2xl leading-tight font-medium text-neutral-500 dark:text-neutral-500">
				{currentMeta.description}
			</p>
			<div class="mt-3 flex flex-wrap items-center gap-1.5">
				<span
					class="text-xs font-medium tracking-widest text-neutral-400 uppercase dark:text-neutral-600"
				>
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
		<div use:lightboxAction class="prose-post mt-10">
			{#if lang === 'ko' && currentMeta?.aiTranslated}
				<div
					class="mb-10 flex items-start gap-3 border-l-2 border-amber-400/80 bg-amber-100/40 px-4 py-3 dark:border-amber-500/60 dark:bg-amber-950/20"
				>
					<Languages
						size="16"
						strokeWidth="2"
						class="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
						aria-hidden="true"
					/>
					<div>
						<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">AI 번역</p>
						<p class="text-sm text-neutral-500 dark:text-neutral-500">
							이 글은 영어 원문을 AI의 도움을 받아 번역했습니다. 일부 내용에 오류가 있을 수
							있습니다.
						</p>
					</div>
				</div>
			{/if}
			{#if currentContent}
				<svelte:component this={currentContent} class="prose" />
			{/if}
		</div>
	</article>
</div>

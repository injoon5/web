<script>
	import LikeButton from '$lib/LikeButton.svelte';
	import { page } from '$app/stores';
	import Lightbox from '../../../lib/Lightbox.svelte';
	import { lightboxAction } from '$lib/lightbox.js';
	import Languages from '@lucide/svelte/icons/languages';
	import NumberFlow from '@number-flow/svelte';
	import { autoHeight } from '$lib/autoHeight.js';

	import { onMount, tick } from 'svelte';
	import { fly, blur } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	const blurT = (node, params) => (params.duration ? blur(node, params) : {});
	const flyT = (node, params) => (params.duration ? fly(node, params) : {});

	export let data;

	let lang =
		data.prefLang && data.availableLangs.includes(data.prefLang)
			? data.prefLang
			: (data.availableLangs[0] ?? 'en');
	let displayLang = lang;

	function persistLang(l) {
		try {
			localStorage.setItem('preferred-lang', l);
			document.cookie = `preferred-lang=${l}; path=/; max-age=31536000; samesite=lax`;
		} catch {
			// localStorage / cookies may be unavailable.
		}
	}

	let dir = 1;
	let reduceMotion = false;
	let mounted = false;
	let animating = false;

	onMount(async () => {
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!data.prefLang) {
			const saved = localStorage.getItem('preferred-lang');
			if (saved && data.availableLangs.includes(saved)) {
				lang = saved;
				displayLang = saved;
			}
		}
		if (lang !== (data.availableLangs[0] ?? 'en') || data.prefLang) persistLang(lang);
		await tick();
		requestAnimationFrame(() => requestAnimationFrame(() => (mounted = true)));
	});

	function setLang(l) {
		if (l === lang) return;
		lang = l;
		persistLang(l);
		advanceDisplay();
	}

	let swapTimer;
	function advanceDisplay() {
		if (animating || displayLang === lang) return;
		dir = data.availableLangs.indexOf(lang) >= data.availableLangs.indexOf(displayLang) ? 1 : -1;
		displayLang = lang;
		if (animate) {
			animating = true;
			clearTimeout(swapTimer);
			swapTimer = setTimeout(onSwapEnd, 800);
		}
	}

	function onSwapEnd() {
		clearTimeout(swapTimer);
		animating = false;
		advanceDisplay();
	}

	let bodyWidth = 0;

	$: animate = mounted && !reduceMotion;
	$: titleBlur = { amount: 8, opacity: 0, duration: animate ? 420 : 0, easing: cubicOut };
	$: headerHeight = { duration: animate ? 420 : 0, enabled: animate };
	$: bodyIn = {
		x: dir * (bodyWidth + 32),
		opacity: 1,
		duration: animate ? 440 : 0,
		easing: cubicOut
	};
	$: bodyOut = {
		x: -dir * (bodyWidth + 32),
		opacity: 1,
		duration: animate ? 440 : 0,
		easing: cubicOut
	};

	function metaFor(l) {
		return l === 'ko' && data.koMeta ? data.koMeta : (data.enMeta ?? data.meta);
	}
	function contentFor(l) {
		return l === 'ko' && data.koContent ? data.koContent : data.enContent;
	}
	function readingTimeFor(l) {
		return l === 'ko' && data.koReadingTime ? data.koReadingTime : data.enReadingTime;
	}

	$: currentMeta = metaFor(displayLang);
	$: currentReadingTime = readingTimeFor(displayLang);
	$: readingMinutes = parseInt(currentReadingTime ?? '', 10);
	$: ogMeta = data.koMeta ?? data.enMeta ?? data.meta;
	$: ogImageUrl = `https://www.injoon5.com/api/og?template=project&title=${encodeURIComponent(ogMeta.title)}&description=${encodeURIComponent(ogMeta.description || '')}&year=${encodeURIComponent(ogMeta.year || '')}&tags=${encodeURIComponent((ogMeta.tags || []).join(','))}`;

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
	<title>{ogMeta.title}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={ogMeta.title} />
	<meta property="og:description" content={ogMeta.description ?? ''} />
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
			<div class="overflow-hidden" use:autoHeight={headerHeight}>
				<div class="grid" data-auto-height-inner>
					{#each [displayLang] as l (l)}
						<h1
							style="grid-area: 1 / 1;"
							in:blurT={titleBlur}
							out:blurT={titleBlur}
							class="text-3xl font-semibold tracking-tight md:font-semibold"
						>
							{metaFor(l).title}
						</h1>
					{/each}
				</div>
			</div>
			<div
				class="mt-1 flex flex-row items-center text-2xl font-medium text-neutral-600 dark:text-neutral-400"
			>
				<p class="tabular">{currentMeta.year}</p>
				{#if !isNaN(readingMinutes)}
					<p class="mx-1">·</p>
					<NumberFlow value={readingMinutes} suffix=" min read" />
				{/if}
			</div>
			<div class="mt-3 overflow-hidden" use:autoHeight={headerHeight}>
				<div class="grid" data-auto-height-inner>
					{#each [displayLang] as l (l)}
						<p
							style="grid-area: 1 / 1;"
							in:blurT={titleBlur}
							out:blurT={titleBlur}
							class="text-2xl leading-tight font-medium text-neutral-500 dark:text-neutral-500"
						>
							{metaFor(l).description}
						</p>
					{/each}
				</div>
			</div>
			<div class="mt-3 flex flex-wrap items-center gap-2">
				<span class="text-sm text-neutral-600 dark:text-neutral-400">Stack</span>
				{#each currentMeta.tags as tag}
					<span
						class="inline-flex items-center rounded-full border border-neutral-200 px-2.5 py-1 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"
					>
						{tag}
					</span>
				{/each}
			</div>
			{#if data.availableLangs.length > 1}
				<div
					class="relative mt-3 inline-flex items-center gap-1 rounded-full border border-neutral-200/70 bg-neutral-100/60 p-1 dark:border-neutral-800/70 dark:bg-neutral-900/60"
				>
					<span
						class="nav-indicator pointer-events-none absolute top-1 bottom-1 left-0 rounded-full bg-neutral-900 dark:bg-neutral-100"
						class:nav-animate={mounted}
						style={pillStyle || 'opacity:0;'}
						aria-hidden="true"
					></span>
					{#each data.availableLangs as l}
						<button
							bind:this={langButtons[l]}
							on:click={() => setLang(l)}
							class="relative z-10 rounded-full px-3 {l === 'en'
								? 'mr-0.5'
								: ''} py-1 text-sm font-semibold text-neutral-500 transition-colors duration-150 hover:text-neutral-900 dark:hover:text-neutral-100"
						>
							{l === 'en' ? 'English' : '한국어'}
						</button>
					{/each}
					<div
						class="nav-clip pointer-events-none absolute inset-0 z-20 flex items-center gap-1 p-1"
						class:nav-animate={mounted}
						style={clipStyle || 'clip-path: inset(4px 100% 4px 0 round 9999px);'}
						aria-hidden="true"
					>
						{#each data.availableLangs as l}
							<span
								class="rounded-full px-3 {l === 'en'
									? 'mr-0.5'
									: ''} py-1 text-sm font-semibold text-white dark:text-neutral-900"
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
		</div>

		<div class="mt-10 grid min-w-0 overflow-hidden" bind:clientWidth={bodyWidth}>
			{#each [displayLang] as l (l)}
				{@const content = contentFor(l)}
				<div
					class="min-w-0 overflow-x-hidden"
					style="grid-area: 1 / 1;"
					in:flyT={bodyIn}
					out:flyT={bodyOut}
					on:introend={onSwapEnd}
				>
					{#if metaFor(l)?.aiTranslated}
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
								{#if l === 'ko'}
									<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">AI 번역</p>
									<p class="text-sm text-neutral-500 dark:text-neutral-500">
										이 글은 AI의 도움을 받아 번역되었습니다. 일부 내용에 오류가 있을 수 있습니다.
									</p>
								{:else}
									<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
										AI Translation
									</p>
									<p class="text-sm text-neutral-500 dark:text-neutral-500">
										This post was translated from Korean with the help of AI. Some nuance may be
										lost.
									</p>
								{/if}
							</div>
						</div>
					{/if}
					<div use:lightboxAction class="prose-post">
						{#if content}
							<svelte:component this={content} class="prose" />
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</article>
</div>

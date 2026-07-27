<script>
	import { formatDate } from '$lib/utils';
	import BookCover from '$lib/books/BookCover.svelte';
	import Rating from '$lib/books/Rating.svelte';
	import CommentsSection from '$lib/comments/CommentsSection.svelte';
	import LikeButton from '$lib/LikeButton.svelte';
	import { page } from '$app/stores';
	import Lightbox from '$lib/Lightbox.svelte';
	import { lightboxAction } from '$lib/lightbox.js';
	import Languages from '@lucide/svelte/icons/languages';
	import { autoHeight } from '$lib/autoHeight.js';
	import LanguageSwitcher from '$lib/LanguageSwitcher.svelte';

	import { onMount, tick } from 'svelte';
	import { fly, blur } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	const blurT = (node, params) => (params.duration ? blur(node, params) : {});
	const flyT = (node, params) => (params.duration ? fly(node, params) : {});

	export let data;

	let lang =
		data.prefLang && data.availableLangs.includes(data.prefLang)
			? data.prefLang
			: (data.availableLangs[0] ?? 'ko');
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
		if (lang !== (data.availableLangs[0] ?? 'ko') || data.prefLang) persistLang(lang);
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
	// The hero book grows with the viewport but stops before it starts pushing
	// the title column into a column of single words.
	let viewportWidth = 0;
	$: coverHeight = viewportWidth >= 1024 ? 340 : viewportWidth >= 640 ? 300 : 260;

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

	$: currentMeta = metaFor(displayLang);
	// The physical book is the same object in either language, so its artwork,
	// cloth and page count come from whichever file defines them.
	$: object = {
		slug: $page.params.slug,
		title: currentMeta.title,
		author: currentMeta.author,
		cover: data.enMeta?.cover ?? data.koMeta?.cover ?? '',
		spine: data.enMeta?.spine ?? data.koMeta?.spine ?? '',
		color: data.enMeta?.color ?? data.koMeta?.color,
		pages: data.enMeta?.pages ?? data.koMeta?.pages
	};
	$: headMeta = metaFor(displayLang) ?? data.meta;
	$: ogImageUrl = `https://www.injoon5.com/api/og?template=book&title=${encodeURIComponent(headMeta.title)}&author=${encodeURIComponent(headMeta.author || '')}&description=${encodeURIComponent(headMeta.description || '')}&date=${encodeURIComponent(headMeta.date || '')}`;
	$: if (typeof document !== 'undefined') document.documentElement.lang = displayLang;
</script>

<svelte:head>
	<title>{headMeta.title}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={headMeta.title} />
	<meta property="og:description" content={headMeta.description ?? ''} />
	<meta property="og:image" content={ogImageUrl} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={ogImageUrl} />
	<meta property="og:url" content="https://www.injoon5.com/books/{$page.params.slug}" />
	{#each data.availableLangs as l}
		<link
			rel="alternate"
			hreflang={l}
			href="https://www.injoon5.com/books/{$page.params.slug}?lang={l}"
		/>
	{/each}
	<link
		rel="alternate"
		hreflang="x-default"
		href="https://www.injoon5.com/books/{$page.params.slug}"
	/>
</svelte:head>

<svelte:window bind:innerWidth={viewportWidth} />

<Lightbox />

<div class="grid grid-cols-1 gap-4 md:grid-cols-12">
	<article
		class="col-span-1 justify-center pt-10 md:col-span-10 md:col-start-2 lg:col-span-8 lg:col-start-3"
	>
		<!-- Side by side, the book is centred against the block of text rather
		     than hung from its first line — the two are one unit. -->
		<div
			class="flex flex-col items-start gap-8 tracking-tight sm:flex-row sm:items-center sm:gap-10"
		>
			<div class="shrink-0">
				<BookCover book={object} height={coverHeight} />
			</div>

			<div class="min-w-0 flex-1">
				<div class="overflow-hidden" use:autoHeight={headerHeight}>
					<div class="grid" data-auto-height-inner>
						{#each [displayLang] as l (l)}
							<h1
								style="grid-area: 1 / 1;"
								in:blurT={titleBlur}
								out:blurT={titleBlur}
								class="text-3xl font-semibold tracking-tight text-balance"
							>
								{metaFor(l).title}
							</h1>
						{/each}
					</div>
				</div>

				{#if currentMeta.author}
					<div class="overflow-hidden" use:autoHeight={headerHeight}>
						<div class="grid" data-auto-height-inner>
							{#each [displayLang] as l (l)}
								<p
									style="grid-area: 1 / 1;"
									in:blurT={titleBlur}
									out:blurT={titleBlur}
									class="text-xl font-medium text-neutral-500 dark:text-neutral-500"
								>
									{metaFor(l).author}
								</p>
							{/each}
						</div>
					</div>
				{/if}

				<div
					class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium text-neutral-600 dark:text-neutral-400"
				>
					{#if currentMeta.rating}
						<!-- The number is right there; the marks are the same fact drawn. -->
						<Rating rating={currentMeta.rating} size={14} labelled={false} />
						<span class="tabular">{currentMeta.rating.toFixed?.(1) ?? currentMeta.rating}</span>
						<span class="text-neutral-300 dark:text-neutral-700">·</span>
					{/if}
					{#if currentMeta.reading}
						<span>Reading now</span>
					{:else if currentMeta.date}
						<span class="tabular whitespace-nowrap">Finished {formatDate(currentMeta.date)}</span>
					{/if}
					{#if currentMeta.pages}
						<span class="text-neutral-300 dark:text-neutral-700">·</span>
						<span class="tabular whitespace-nowrap">{currentMeta.pages} pages</span>
					{/if}
				</div>

				{#if currentMeta.description}
					<div class="mt-3 overflow-hidden" use:autoHeight={headerHeight}>
						<div class="grid" data-auto-height-inner>
							{#each [displayLang] as l (l)}
								<p
									style="grid-area: 1 / 1;"
									in:blurT={titleBlur}
									out:blurT={titleBlur}
									class="text-lg leading-snug font-medium text-pretty text-neutral-500 dark:text-neutral-500"
								>
									{metaFor(l).description}
								</p>
							{/each}
						</div>
					</div>
				{/if}

				<LanguageSwitcher
					{lang}
					{mounted}
					availableLangs={data.availableLangs}
					onselect={setLang}
				/>
				<div class="my-4">
					<LikeButton />
				</div>
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

		<div class="my-10">
			<CommentsSection />
		</div>
	</article>
</div>

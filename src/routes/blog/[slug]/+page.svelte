<script>
	import { formatDate } from '$lib/utils';
	import SeriesList from '$lib/SeriesList.svelte';
	import CommentsSection from '$lib/comments/CommentsSection.svelte';
	import LikeButton from '$lib/LikeButton.svelte';
	import { page } from '$app/stores';
	import Lightbox from '../../../lib/Lightbox.svelte';
	import { lightboxAction } from '$lib/lightbox.js';
	import Languages from '@lucide/svelte/icons/languages';
	import NumberFlow from '@number-flow/svelte';
	import BlurHeightSwap from '$lib/BlurHeightSwap.svelte';

	import { onMount, tick } from 'svelte';
	import { fly, blur } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	// When duration is 0 (initial load / reduced motion) return an empty config
	// so NO starting style is applied — a zero-length fly still paints its
	// opacity-0 start frame, which looked like a blink on load.
	const flyT = (node, params) => (params.duration ? fly(node, params) : {});

	export let data;

	// `lang` is the selected language (drives the selector pill instantly).
	// `displayLang` is the content currently shown; it catches up to `lang`
	// one animation at a time so rapid switches can't stack transitions.
	// Initialised from the server-resolved preference (cookie / ?lang=) so the
	// server already rendered this language — no post-hydration flash.
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

	// Direction of the language swap, used to slide content the right way.
	let dir = 1;
	let reduceMotion = false;
	// Stays false until after the initial (possibly localStorage-restored) language
	// is applied, so that first paint and that restore don't animate.
	let mounted = false;
	let animating = false;

	onMount(async () => {
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		// The server already applied ?lang=/cookie. This only covers legacy users
		// who have a localStorage preference but no cookie yet: apply it (instant,
		// no animation since not mounted) and write the cookie so future server
		// renders are correct — migrating them off the flash path.
		if (!data.prefLang) {
			const saved = localStorage.getItem('preferred-lang');
			if (saved && data.availableLangs.includes(saved)) {
				lang = saved;
				displayLang = saved;
			}
		}
		if (lang !== (data.availableLangs[0] ?? 'ko') || data.prefLang) persistLang(lang);
		await tick();
		// Enable animations only after the restored language and the positioned
		// pill have actually painted. A single tick isn't a reliable barrier:
		// Svelte starts transitions on a later frame, so we wait two frames.
		requestAnimationFrame(() => requestAnimationFrame(() => (mounted = true)));
	});

	function setLang(l) {
		if (l === lang) return;
		lang = l;
		persistLang(l);
		advanceDisplay();
	}

	// Step the displayed content toward the selected language. Only one
	// transition runs at a time; the next step fires when the current slide
	// finishes (onSwapEnd), so rapid switching can't stack transitions. A
	// fallback timer clears `animating` even if introend is ever missed, so
	// the content can never get stuck/frozen.
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
	// Both directions share duration + easing so the panels stay a constant gap apart while sliding.
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

	$: currentMeta = displayLang === 'ko' && data.koMeta ? data.koMeta : (data.enMeta ?? data.meta);
	$: currentContent = displayLang === 'ko' && data.koContent ? data.koContent : data.enContent;
	$: currentReadingTime =
		displayLang === 'ko' && data.koReadingTime ? data.koReadingTime : data.enReadingTime;
	$: readingMinutes = parseInt(currentReadingTime ?? '', 10);
	$: currentSeries = displayLang === 'ko' ? data.koSeries : data.enSeries;
	$: ogMeta = data.koMeta ?? data.enMeta ?? data.meta;
	$: ogImageUrl = `https://www.injoon5.com/api/og?template=blog-post&title=${encodeURIComponent(ogMeta.title)}&description=${encodeURIComponent(ogMeta.description || '')}&date=${encodeURIComponent(ogMeta.date || '')}`;

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
	$: (lang, updatePill());
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
	<title>{ogMeta.title}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={ogMeta.title} />
	<meta property="og:description" content={ogMeta.description ?? ''} />
	<meta property="og:image" content={ogImageUrl} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={ogImageUrl} />
	<meta property="og:url" content="https://www.injoon5.com/blog/{$page.params.slug}" />
</svelte:head>

<Lightbox />

<div class="grid grid-cols-1 gap-4 md:grid-cols-12">
	<article
		class="col-span-1 justify-center pt-10 md:col-span-10 md:col-start-2 lg:col-span-8 lg:col-start-3"
	>
		<!-- Title -->
		<div class="tracking-tight">
			{#if currentSeries?.[0]?.series}
				<BlurHeightSwap swapKey={displayLang} blurParams={titleBlur} {animate}>
					<h2 class="text-xl font-medium text-neutral-500 dark:text-neutral-500">
						{currentSeries[0].series}
					</h2>
				</BlurHeightSwap>
			{/if}
			<BlurHeightSwap swapKey={displayLang} blurParams={titleBlur} {animate}>
				<h1 class="text-3xl font-semibold tracking-tight md:font-semibold">
					{currentMeta.title}
				</h1>
			</BlurHeightSwap>
			<div
				class="mt-1 flex flex-row items-center text-xl font-medium text-neutral-600 dark:text-neutral-400"
			>
				<p class="tabular">{formatDate(currentMeta.date)}</p>
				{#if !isNaN(readingMinutes)}
					<p class="mx-1">·</p>
					<NumberFlow value={readingMinutes} suffix=" min read" />
				{/if}
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
			{#if currentSeries?.length > 1 && currentMeta?.series != undefined}
				<div class="my-4">
					<SeriesList series={currentSeries} />
				</div>
			{/if}
		</div>

		<!-- Post -->
		<div class="mt-10 grid overflow-hidden" bind:clientWidth={bodyWidth}>
			{#key displayLang}
				<div style="grid-area: 1 / 1;" in:flyT={bodyIn} out:flyT={bodyOut} on:introend={onSwapEnd}>
					{#if currentMeta?.aiTranslated}
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
								{#if displayLang === 'ko'}
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
						{#if currentContent}
							<svelte:component this={currentContent} class="prose" />
						{/if}
					</div>
				</div>
			{/key}
		</div>

		<div class="my-10">
			<CommentsSection />
		</div>
	</article>
</div>

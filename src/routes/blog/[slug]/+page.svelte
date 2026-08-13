<script>
	import { motion } from '$lib/reduced-motion.svelte.js';
	import ArticleDialsMount from '$lib/article/ArticleDialsMount.svelte';
	import { articleSettings, articleStyle } from '$lib/article/settings.svelte.js';
	import { formatDate } from '$lib/format.js';
	import SeriesList from '$lib/ui/SeriesList.svelte';
	import CommentsSection from '$lib/comments/CommentsSection.svelte';
	import LikeButton from '$lib/likes/LikeButton.svelte';
	import { page } from '$app/state';
	import Lightbox from '$lib/lightbox/Lightbox.svelte';
	import { lightboxAction } from '$lib/lightbox/store.svelte.js';
	import Languages from '@lucide/svelte/icons/languages';
	import NumberFlow from '@number-flow/svelte';
	import { autoHeight } from '$lib/actions/auto-height.js';
	import LanguageSwitcher from '$lib/ui/LanguageSwitcher.svelte';
	import StableLangStack from '$lib/ui/StableLangStack.svelte';
	import {
		blogPostingSchema,
		breadcrumbSchema,
		keywordsFor,
		jsonLdScript
	} from '$lib/seo/jsonld.js';

	import { onMount, tick, untrack } from 'svelte';
	import { fly, blur } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	// When duration is 0 (initial load / reduced motion) return an empty config
	// so NO starting style is applied — a zero-length blur/fly still paints its
	// opacity-0 start frame, which looked like a blink on load.
	const blurT = (node, params) => (params.duration ? blur(node, params) : {});
	const flyT = (node, params) => (params.duration ? fly(node, params) : {});

	let { data } = $props();

	// `lang` is the selected language (drives the selector pill instantly).
	// `displayLang` is the content currently shown; it catches up to `lang`
	// one animation at a time so rapid switches can't stack transitions.
	// Initialised from the server-resolved preference (cookie / ?lang=) so the
	// server already rendered this language — no post-hydration flash.
	// `untrack` is the point, not a workaround: this is the *initial* language
	// only. Once the visitor picks one, `lang` is theirs and a later `data`
	// change must not yank the content back to the server's preference.
	const initialLang = untrack(() =>
		data.prefLang && data.availableLangs.includes(data.prefLang)
			? data.prefLang
			: (data.availableLangs[0] ?? 'ko')
	);
	let lang = $state(initialLang);
	let displayLang = $state(initialLang);

	function persistLang(l) {
		try {
			localStorage.setItem('preferred-lang', l);
			document.cookie = `preferred-lang=${l}; path=/; max-age=31536000; samesite=lax`;
		} catch {
			// localStorage / cookies may be unavailable.
		}
	}

	// Direction of the language swap, used to slide content the right way.
	let dir = $state(1);
	// Stays false until after the initial (possibly localStorage-restored) language
	// is applied, so that first paint and that restore don't animate.
	let mounted = $state(false);
	let animating = $state(false);

	onMount(async () => {
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

	let bodyWidth = $state(0);

	const animate = $derived(mounted && !motion.reduced);
	const titleBlur = $derived({
		amount: 8,
		opacity: 0,
		duration: animate ? 420 : 0,
		easing: cubicOut
	});
	const headerHeight = $derived({ duration: animate ? 420 : 0, enabled: animate });
	// Both directions share duration + easing so the panels stay a constant gap apart while sliding.
	const bodyIn = $derived({
		x: dir * (bodyWidth + 32),
		opacity: 1,
		duration: animate ? 440 : 0,
		easing: cubicOut
	});
	const bodyOut = $derived({
		x: -dir * (bodyWidth + 32),
		opacity: 1,
		duration: animate ? 440 : 0,
		easing: cubicOut
	});

	function metaFor(l) {
		return l === 'ko' && data.koMeta ? data.koMeta : (data.enMeta ?? data.meta);
	}
	function contentFor(l) {
		return l === 'ko' && data.koContent ? data.koContent : data.enContent;
	}
	function readingTimeFor(l) {
		return l === 'ko' && data.koReadingTime ? data.koReadingTime : data.enReadingTime;
	}
	function seriesFor(l) {
		return l === 'ko' ? data.koSeries : data.enSeries;
	}

	const currentMeta = $derived(metaFor(displayLang));
	const currentReadingTime = $derived(readingTimeFor(displayLang));
	const readingMinutes = $derived(parseInt(currentReadingTime ?? '', 10));
	const currentSeries = $derived(seriesFor(displayLang));
	// Head metadata tracks the language actually being shown so the tab title and
	// social card match the visible content (and default to Korean for crawlers).
	const headMeta = $derived(metaFor(displayLang) ?? data.meta);
	const ogImageUrl = $derived(
		`https://www.injoon5.com/api/og?template=blog-post&title=${encodeURIComponent(headMeta.title)}&description=${encodeURIComponent(headMeta.description || '')}&date=${encodeURIComponent(headMeta.date || '')}`
	);
	const postUrl = $derived(`https://www.injoon5.com/blog/${page.params.slug}`);
	const ogLocale = $derived(displayLang === 'en' ? 'en_US' : 'ko_KR');
	const ogLocaleAlt = $derived(displayLang === 'en' ? 'ko_KR' : 'en_US');
	// Author names lead (so 오인준 rides on every article), then the post's own
	// hand-picked keywords, its title, series and tags. The frontmatter keywords
	// come first among the page terms — they are the phrases the post targets.
	const keywords = $derived(
		keywordsFor([
			...(currentMeta?.keywords ?? []),
			headMeta.title,
			currentMeta?.series,
			...(currentMeta?.tags ?? [])
		])
	);
	const keywordsContent = $derived(keywords.join(', '));
	const postSchema = $derived(
		blogPostingSchema({
			title: headMeta.title,
			description: headMeta.description ?? '',
			date: headMeta.date ?? '',
			url: postUrl,
			image: ogImageUrl,
			lang: displayLang,
			keywords,
			section: currentMeta?.series
		})
	);
	const crumbs = $derived(
		breadcrumbSchema([
			{ name: 'Injoon Oh', url: 'https://www.injoon5.com/' },
			{ name: 'Blog', url: 'https://www.injoon5.com/blog' },
			{ name: headMeta.title, url: postUrl }
		])
	);
	// Keep <html lang> in sync with the shown language (SSR sets it via hooks.server.ts).
	$effect(() => {
		document.documentElement.lang = displayLang;
	});
</script>

<!-- SEO -->
<svelte:head>
	<title>{headMeta.title}</title>
	<meta name="description" content={headMeta.description ?? ''} />
	<meta name="author" content="Injoon Oh (오인준)" />
	<meta name="keywords" content={keywordsContent} />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={headMeta.title} />
	<meta property="og:description" content={headMeta.description ?? ''} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:locale" content={ogLocale} />
	{#if data.availableLangs.length > 1}
		<meta property="og:locale:alternate" content={ogLocaleAlt} />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={ogImageUrl} />
	<meta property="og:url" content={postUrl} />
	<meta property="article:published_time" content={headMeta.date ?? ''} />
	<meta property="article:author" content="Injoon Oh (오인준)" />
	{#if currentMeta?.series}
		<meta property="article:section" content={currentMeta.series} />
	{/if}
	{#each currentMeta?.tags ?? [] as tag (tag)}
		<meta property="article:tag" content={tag} />
	{/each}
	{@html jsonLdScript(postSchema)}
	{@html jsonLdScript(crumbs)}
	{#each data.availableLangs as l (l)}
		<link
			rel="alternate"
			hreflang={l}
			href="https://www.injoon5.com/blog/{page.params.slug}?lang={l}"
		/>
	{/each}
	<link
		rel="alternate"
		hreflang="x-default"
		href="https://www.injoon5.com/blog/{page.params.slug}"
	/>
</svelte:head>

<Lightbox />

<div class="grid grid-cols-1 gap-4 md:grid-cols-12">
	<article
		class="col-span-1 justify-center pt-10 md:col-span-10 md:col-start-2 lg:col-span-8 lg:col-start-3"
	>
		<!-- Title -->
		<div class="tracking-tight">
			{#if currentSeries?.[0]?.series}
				<div class="overflow-hidden" use:autoHeight={headerHeight}>
					<div class="grid" data-auto-height-inner>
						{#each [displayLang] as l (l)}
							<h2
								style="grid-area: 1 / 1;"
								in:blurT={titleBlur}
								out:blurT={titleBlur}
								class="text-xl font-medium text-neutral-500 dark:text-neutral-500"
							>
								{seriesFor(l)[0].series}
							</h2>
						{/each}
					</div>
				</div>
			{/if}
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
				class="mt-1 flex flex-row items-center text-xl font-medium text-neutral-600 dark:text-neutral-400"
			>
				<p class="tabular whitespace-nowrap">{formatDate(currentMeta.date)}</p>
				{#if !isNaN(readingMinutes)}
					<p class="mx-1">·</p>
					<span class="tabular inline-flex whitespace-nowrap">
						<!-- No ghost stack behind the count: sizing it to the widest language leaves a
						     whole tabular digit of dead space next to the shorter one (7 ko / 10 en).
						     NumberFlow animates its own width across the swap. -->
						<span class="shrink-0 leading-none">
							<NumberFlow value={readingMinutes} />
						</span>
						<!-- The unit's gap is a no-break space: each label is its own grid item, and a
						     plain leading space is dropped at the start of its line box (measured 0px,
						     "10min read"). Korean sets the unit tight against the number, as it should. -->
						<StableLangStack
							langs={data.availableLangs}
							{displayLang}
							transition={titleBlur}
							text={(l) => (l === 'ko' ? '분 읽기' : '\u00a0min read')}
						/>
					</span>
				{/if}
			</div>
			<LanguageSwitcher {lang} {mounted} availableLangs={data.availableLangs} onselect={setLang} />
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
		<div class="mt-10 grid min-w-0 overflow-hidden" bind:clientWidth={bodyWidth}>
			{#each [displayLang] as l (l)}
				{@const Content = contentFor(l)}
				<div
					class="min-w-0 overflow-x-hidden"
					style="grid-area: 1 / 1;"
					in:flyT={bodyIn}
					out:flyT={bodyOut}
					onintroend={onSwapEnd}
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
					<div use:lightboxAction class="prose-post" style={articleStyle(articleSettings)}>
						{#if Content}
							<Content class="prose" />
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

<!-- Preview deployments only, and compiled out entirely everywhere else. -->
<ArticleDialsMount />

<script>
	/**
	 * A blog post or a project page: everything the two have in common. The route
	 * passes its data (from `articleLoad`) and fills in what differs as snippets.
	 *
	 * The language is the URL (`#lib/content/article-paths.js`). Switching it is a
	 * navigation to the other URL that keeps this component mounted — same route,
	 * different param — so the content can still slide across rather than reload.
	 * The route wraps this in `{#key data.slug}`: a different article is a fresh
	 * component, never an animated language swap between two posts.
	 */
	import { onMount, tick, untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import Languages from '@lucide/svelte/icons/languages';
	import { motion } from '#lib/reduced-motion.svelte.js';
	import ArticleDialsMount from '#lib/article/ArticleDialsMount.svelte';
	import { articleSettings, articleStyle } from '#lib/article/settings.svelte.js';
	import SwapLine from '#lib/article/SwapLine.svelte';
	import LikeButton from '#lib/likes/LikeButton.svelte';
	import Lightbox from '#lib/lightbox/Lightbox.svelte';
	import { lightboxAction } from '#lib/lightbox/store.svelte.js';
	import NumberFlow from '#lib/ui/NumberFlow.svelte';
	import LanguageSwitcher from '#lib/ui/LanguageSwitcher.svelte';
	import StableLangStack from '#lib/ui/StableLangStack.svelte';
	import { SITE_URL, articleBase, articlePath } from '#lib/content/article-paths.js';
	import { preloadArticle } from '#lib/content/preload-articles.js';
	import { cookieLang, persistLang } from '#lib/visitor.svelte.js';

	/**
	 * @typedef {{ meta: Record<string, any>, content: any, series: any[] }} LangEntry
	 * @typedef {{
	 *   displayLang: string,
	 *   entryFor: (lang: string) => LangEntry,
	 *   titleBlur: { duration: number } & Record<string, unknown>,
	 *   headerHeight: { duration: number, enabled: boolean }
	 * }} View
	 */

	/**
	 * @type {{
	 *   data: any;
	 *   ogImage: (meta: Record<string, any>) => string;
	 *   bylineClass?: string;
	 *   head?: import('svelte').Snippet<[Record<string, any>, string]>;
	 *   eyebrow?: import('svelte').Snippet<[View]>;
	 *   dateline: import('svelte').Snippet<[Record<string, any>]>;
	 *   intro?: import('svelte').Snippet<[View]>;
	 *   aside?: import('svelte').Snippet<[View]>;
	 *   footer?: import('svelte').Snippet;
	 * }}
	 */
	let {
		data,
		ogImage,
		bylineClass = 'text-xl',
		head,
		eyebrow,
		dateline,
		intro,
		aside,
		footer
	} = $props();

	const flyT = (node, params) => (params.duration ? fly(node, params) : {});

	// The outgoing language has to keep rendering through its exit transition,
	// after `data` has moved on to the incoming one. Not state: nothing renders
	// *because* it changed, only *from* it.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const seen = new Map();
	/** @param {string} l @returns {LangEntry} */
	function entryFor(l) {
		if (l === data.lang) {
			const entry = { meta: data.meta, content: data.content, series: data.series };
			seen.set(l, entry);
			return entry;
		}
		return seen.get(l) ?? { meta: data.meta, content: null, series: [] };
	}

	// `lang` drives the switcher's pill, which moves the moment it is clicked.
	// `displayLang` is the content on screen; it catches up to `data.lang` (the
	// URL) one animation at a time, so rapid switches can't stack transitions.
	let lang = $state(untrack(() => data.lang));
	let displayLang = $state(untrack(() => data.lang));
	let dir = $state(1);
	// Off until after first paint, so the first paint does not animate.
	let mounted = $state(false);
	let animating = $state(false);
	let swapTimer;

	const animate = $derived(mounted && !motion.reduced);

	/** @param {string} l */
	const hrefFor = (l) => articlePath(data.kind, data.slug, l, data.langs);

	async function setLang(l) {
		if (l === lang) return;
		lang = l;
		persistLang(l);
		try {
			await goto(hrefFor(l), { replace: true, reset: false });
		} catch {
			lang = data.lang;
		}
	}

	// The URL moved (a switch, or the legacy-preference hop below): follow it.
	$effect(() => {
		const target = data.lang;
		untrack(() => {
			lang = target;
			advanceDisplay();
		});
	});

	function advanceDisplay() {
		if (animating || displayLang === data.lang) return;
		dir = data.langs.indexOf(data.lang) >= data.langs.indexOf(displayLang) ? 1 : -1;
		displayLang = data.lang;
		if (animate) {
			animating = true;
			clearTimeout(swapTimer);
			// introend can be missed; the content must never stay frozen.
			swapTimer = setTimeout(onSwapEnd, 800);
		}
	}

	function onSwapEnd() {
		clearTimeout(swapTimer);
		animating = false;
		advanceDisplay();
	}

	onMount(async () => {
		// Visitors from before the language was a cookie kept it in localStorage.
		// Give them the cookie, so vercel.json takes them to /en next time.
		let legacy = null;
		try {
			legacy = cookieLang() ? null : localStorage.getItem('preferred-lang');
		} catch {
			// Storage may be unavailable.
		}
		if (legacy) {
			persistLang(legacy);
			if (legacy !== data.lang && data.langs.includes(legacy)) {
				goto(hrefFor(legacy), { replace: true, reset: false }).catch(() => {});
			}
		}
		await tick();
		// Enable animations only after the first paint: Svelte starts transitions
		// on a later frame, so wait two.
		requestAnimationFrame(() => requestAnimationFrame(() => (mounted = true)));
		// The other language, so a switch never waits on the network.
		const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 300));
		idle(() => preloadArticle(articleBase(data.kind, data.slug)));
	});

	let bodyWidth = $state(0);
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

	const current = $derived(entryFor(displayLang));
	const readingMinutes = $derived(parseInt(current.meta.readingTime ?? '', 10));

	/** @type {View} */
	const view = {
		get displayLang() {
			return displayLang;
		},
		entryFor,
		get titleBlur() {
			return titleBlur;
		},
		get headerHeight() {
			return headerHeight;
		}
	};

	// The head describes the URL, which is `data.lang`, not the animation.
	const url = $derived(SITE_URL + data.canonicalPath);
	const ogLocale = (l) => (l === 'en' ? 'en_US' : 'ko_KR');

	$effect(() => {
		document.documentElement.lang = displayLang;
	});
</script>

<svelte:head>
	<title>{data.meta.title}</title>
	<meta name="description" content={data.meta.description ?? ''} />
	<meta name="author" content="Injoon Oh (오인준)" />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={data.meta.title} />
	<meta property="og:description" content={data.meta.description ?? ''} />
	<meta property="og:image" content={ogImage(data.meta)} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={ogImage(data.meta)} />
	<meta property="og:url" content={url} />
	<meta property="og:locale" content={ogLocale(data.lang)} />
	{#if data.langs.length > 1}
		{#each data.langs as l (l)}
			{#if l !== data.lang}
				<meta property="og:locale:alternate" content={ogLocale(l)} />
			{/if}
			<link rel="alternate" hreflang={l} href={SITE_URL + hrefFor(l)} />
		{/each}
		<link rel="alternate" hreflang="x-default" href={SITE_URL + hrefFor(data.langs[0])} />
	{/if}
	{@render head?.(data.meta, url)}
</svelte:head>

<Lightbox />

<div class="grid grid-cols-1 gap-4 md:grid-cols-12">
	<article
		class="col-span-1 justify-center pt-10 md:col-span-10 md:col-start-2 lg:col-span-8 lg:col-start-3"
	>
		<div class="tracking-tight">
			{@render eyebrow?.(view)}
			<SwapLine
				tag="h1"
				{displayLang}
				text={(l) => entryFor(l).meta.title}
				transition={titleBlur}
				height={headerHeight}
				class="text-3xl font-semibold tracking-tight md:font-semibold"
			/>
			<div
				class="mt-1 flex flex-row items-center {bylineClass} font-medium text-neutral-600 dark:text-neutral-400"
			>
				{@render dateline(current.meta)}
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
							langs={data.langs}
							{displayLang}
							transition={titleBlur}
							text={(l) => (l === 'ko' ? '분 읽기' : ' min read')}
						/>
					</span>
				{/if}
			</div>
			{@render intro?.(view)}
			<LanguageSwitcher {lang} {mounted} availableLangs={data.langs} onselect={setLang} />
			<div class="my-4">
				<LikeButton />
			</div>
			{@render aside?.(view)}
		</div>

		<!-- Both boxes below clip, the inner one because a scroller clips on both
		     axes. Each is padded 6px and pulled back out by as much margin, so a
		     focus ring (offset 2px, 2px wide) on a link or code block at the
		     column's edge is inside the clip, and the column itself does not move. -->
		<div class="-mx-1.5 mt-10 grid min-w-0 overflow-hidden px-1.5" bind:clientWidth={bodyWidth}>
			{#each [displayLang] as l (l)}
				{@const entry = entryFor(l)}
				{@const Content = entry.content}
				<div
					class="-mx-1.5 min-w-0 overflow-x-hidden px-1.5"
					style="grid-area: 1 / 1;"
					in:flyT={bodyIn}
					out:flyT={bodyOut}
					onintroend={onSwapEnd}
				>
					{#if entry.meta?.aiTranslated}
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

		{@render footer?.()}
	</article>
</div>

<!-- Preview deployments only, and compiled out entirely everywhere else. -->
<ArticleDialsMount />

<script>
	import { onMount, onDestroy } from 'svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import { heroName } from '$lib/nav/hero.svelte.js';
	import { marqueePauseWhenOffscreen, marqueeConstantSpeed } from '$lib/actions/marquee.js';
	import TechStack from '$lib/techstack/TechStack.svelte';
	import HomeDialsMount from '$lib/home/HomeDialsMount.svelte';
	import { homeSettings, homeStyle } from '$lib/home/settings.svelte.js';
	import { techstack } from '$lib/techstack/data.js';

	const { data } = $props();

	// The hero shows the big "Injoon Oh"; once it scrolls out of view the navbar
	// name fades in (see NavBar). An IntersectionObserver drives the handoff so
	// there's no per-frame scroll math.
	let heroNameEl = $state(null);
	let heroObserver;

	// Both feeds are refreshed by a Convex cron every 5 minutes, so these are
	// live subscriptions rather than a fetch on mount.
	const nowQuery = useQuery(api.feeds.nowPlaying, () => ({}));
	const photosQuery = useQuery(api.feeds.photos, () => ({}));

	const tracks = $derived(nowQuery.data?.tracks ?? []);
	const photos = $derived(photosQuery.data?.photos ?? []);

	// The label is "last scrobbled", so the currently-playing track — which has no
	// timestamp — isn't what it should read from.
	const lastScrobbledAt = $derived(
		tracks.find((track) => track.playedAt !== null)?.playedAt ?? null
	);

	// Last.fm's own '30 Jul 2026' wording, and in UTC as it sent it, so the label
	// doesn't shift by a day for readers in another timezone.
	const scrobbleDate = new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});

	onMount(() => {
		// Flip once the hero name passes behind the sticky nav, so the navbar name
		// fades in right as the hero tucks away. The margin is the header's own
		// height, measured rather than asserted: the row is 56px, and the 64 that
		// used to be written here handed the name over 8px after the hero was
		// already gone.
		const navHeight = Math.round(
			document.getElementById('site-nav')?.getBoundingClientRect().height ?? 56
		);
		heroObserver = new IntersectionObserver(
			([entry]) => (heroName.visible = entry.isIntersecting),
			{ rootMargin: `-${navHeight}px 0px 0px 0px`, threshold: 0 }
		);
		if (heroNameEl) heroObserver.observe(heroNameEl);
	});

	onDestroy(() => {
		heroObserver?.disconnect();
		heroName.visible = true;
	});
</script>

<svelte:head>
	<title>Injoon Oh</title>
	<meta charset="UTF-8" />
	<meta property="og:title" content="Injoon Oh" />
	<meta name="description" content="A student who is interested in math, science, and computers." />
	<meta
		property="og:description"
		content="A student who is interested in math, science, and computers."
	/>
	<meta property="og:image" content="https://www.injoon5.com/api/og?template=home" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="https://www.injoon5.com/api/og?template=home" />

	<meta property="og:url" content="https://www.injoon5.com/" />
</svelte:head>

<div
	id="introduction"
	class="mt-20 mb-12 grid grid-cols-3 text-base font-[450] tracking-normal sm:grid-cols-5 md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 flex flex-col justify-start md:col-span-10 lg:col-span-2">
		<div style="height: max-content;">
			<h2
				class="-mb-1 font-sans text-2xl font-semibold tracking-tight text-balance text-neutral-400 dark:text-neutral-500"
			>
				오인준
			</h2>
			<h2
				bind:this={heroNameEl}
				class="hero-name font-sans text-2xl font-medium tracking-tight text-balance text-neutral-900 dark:text-neutral-100"
			>
				Injoon Oh
			</h2>
		</div>
	</div>
	<div class="col-span-5 mt-4 justify-center md:mr-2 lg:mt-0">
		<p class="mb-4 text-pretty text-neutral-900 dark:text-neutral-100">
			I am a student who is interested in math, science, and computers.
		</p>
		<p class="text-pretty text-neutral-900 dark:text-neutral-100">
			I love exploring new concepts and getting to know cool new things. Whether it's tackling
			complex equations, researching about scientific stuff, or trying the latest tech, I'm always
			eager to learn.
		</p>
	</div>
	<div class="col-span-5 mt-4 justify-center md:ml-2 lg:mt-0">
		<p class="mb-2 text-pretty text-neutral-900 dark:text-neutral-100">
			Although I haven't decided the specific domain due to the industry evolving so rapidly, I want
			to be a computer programmer when I grow up. <s class="text-neutral-500"
				>(Nowadays I'm thinking about AI, but who knows?)</s
			>
		</p>
	</div>
</div>
<div
	id="blog"
	class="mt-30 mb-12 grid grid-cols-3 text-lg tracking-tight sm:grid-cols-5 sm:text-xl md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 flex flex-col justify-start md:col-span-10 lg:col-span-2">
		<div class="top-20 md:sticky md:top-24" style="height: max-content;">
			<a href="/blog" class="group">
				<h2
					class="mb-4 text-xl font-medium tracking-tight text-balance text-neutral-900 group-hover:text-neutral-600 dark:text-neutral-100 dark:group-hover:text-neutral-400"
				>
					Blog
				</h2>
			</a>
		</div>
	</div>
	<div class="col-span-10 justify-center lg:mt-0">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each data.posts.slice(0, 4) as post (post.slug)}
				<a
					class="group flex flex-col gap-1 bg-neutral-100 px-4 py-3 text-neutral-900 transition-[background-color,transform] duration-150 ease-out hover:bg-neutral-200 active:scale-[0.98] dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
					href="/blog/{post.slug}"
				>
					<h3
						class="line-clamp-1 text-base font-medium text-neutral-900 group-hover:underline dark:text-neutral-100"
					>
						{post.title}
					</h3>
					<p
						class="mb-1 line-clamp-2 max-h-[2lh] min-h-[2lh] text-sm font-medium break-keep text-neutral-600 dark:text-neutral-400"
					>
						{post.description ||
							'Some amazing post that I forgot or failed to write a description for. '}
					</p>
					<div
						class="flex items-center gap-2 text-sm font-medium text-neutral-500 dark:text-neutral-500"
					>
						<span class="whitespace-nowrap">{post.date || post.year}</span>
						{#if post.hasEn}
							<span class="text-sm font-semibold text-neutral-400 dark:text-neutral-600"
								>English</span
							>
						{/if}
					</div>
				</a>
			{/each}
		</div>
		<div class="mt-2 mb-4 flex justify-end">
			<a
				class="group relative inline-flex items-center text-base font-medium tracking-normal text-neutral-600 transition-colors duration-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100"
				href="/blog"
			>
				<span class="transition-transform duration-200 group-hover:-translate-x-5"
					>Read all Posts</span
				>
				<span
					class="absolute right-0 mr-1 translate-x-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					>→</span
				>
			</a>
		</div>
	</div>
</div>

<div
	id="projects"
	class="mt-20 mb-12 grid grid-cols-3 text-lg tracking-tight sm:grid-cols-5 sm:text-xl md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 flex flex-col justify-start md:col-span-10 lg:col-span-2">
		<div class="top-20 md:sticky md:top-24" style="height: max-content;">
			<a href="/projects" class="group">
				<h2
					class="mb-4 text-xl font-medium tracking-tight text-balance text-neutral-900 group-hover:text-neutral-600 dark:text-neutral-100 dark:group-hover:text-neutral-400"
				>
					Projects
				</h2>
			</a>
		</div>
	</div>
	<div class="col-span-10 justify-center lg:mt-0">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each data.projects.slice(0, 4) as post (post.slug)}
				<a
					class="group flex flex-col gap-1 bg-neutral-100 px-4 py-3 text-neutral-900 transition-[background-color,transform] duration-150 ease-out hover:bg-neutral-200 active:scale-[0.98] dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
					href="/projects/{post.slug}"
				>
					<h3
						class="font-neutral-900 dark:font-neutral-100 line-clamp-1 text-base font-medium group-hover:underline"
					>
						{post.title}
					</h3>
					<p
						class="mb-1 line-clamp-2 max-h-[2lh] min-h-[2lh] text-sm font-medium break-keep text-neutral-600 dark:text-neutral-400"
					>
						{post.description ||
							'Some amazing project that I forgot or failed to write a description for. '}
					</p>
					<div
						class="flex items-center gap-2 text-sm font-medium text-neutral-500 dark:text-neutral-500"
					>
						<span class="whitespace-nowrap">{post.date || post.year}</span>
						{#if post.hasEn}
							<span class="text-sm font-semibold text-neutral-400 dark:text-neutral-600"
								>English</span
							>
						{/if}
					</div>
				</a>
			{/each}
		</div>
		<div class="mt-2 mb-4 flex justify-end">
			<a
				class="group relative inline-flex items-center text-base font-medium tracking-normal text-neutral-600 transition-colors duration-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100"
				href="/projects"
			>
				<span class="transition-transform duration-200 group-hover:-translate-x-5"
					>View all Projects</span
				>
				<span
					class="absolute right-0 mr-1 translate-x-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					>→</span
				>
			</a>
		</div>
	</div>
</div>

<div
	id="tech-stack"
	class="mt-20 mb-12 grid grid-cols-3 text-lg font-medium tracking-tight sm:grid-cols-5 sm:text-xl md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 flex flex-col justify-start md:col-span-10 lg:col-span-2">
		<div class="md:sticky md:top-24" style="height: max-content;">
			<h2 class="text-xl font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
				Tech Stack
			</h2>
		</div>
	</div>
	<div class="col-span-10 mt-4 justify-center lg:mt-0">
		<TechStack {techstack} />
	</div>
</div>

<div
	id="now-listening"
	class="mt-20 mb-12 grid grid-cols-3 text-lg font-medium tracking-tight sm:grid-cols-5 sm:text-xl md:grid-cols-10 lg:relative lg:grid-cols-12"
>
	<div
		class="col-span-3 flex flex-col justify-start md:col-span-10 lg:absolute lg:top-0 lg:left-0 lg:z-10"
	>
		<div class="md:sticky md:top-24 lg:static" style="height: max-content;">
			<h2
				class="text-xl font-medium tracking-tight text-balance text-neutral-900 lg:mt-1 lg:text-white lg:[text-shadow:0_1px_4px_rgba(0,0,0,1),0_2px_16px_rgba(0,0,0,0.9),0_4px_48px_rgba(0,0,0,0.8)] dark:text-neutral-100"
			>
				Now Listening
			</h2>
			<p
				class="text-sm leading-tight font-medium text-neutral-500 lg:text-white lg:opacity-70 lg:[text-shadow:0_1px_4px_rgba(0,0,0,1),0_2px_16px_rgba(0,0,0,0.9),0_4px_48px_rgba(0,0,0,0.8)] dark:text-neutral-500 dark:lg:text-white dark:lg:opacity-70"
			>
				Last updated on
				<span class="inline lg:block">
					{#if nowQuery.isLoading}
						<span class="inline-flex items-center gap-2"> Loading… </span>
					{:else if nowQuery.error != null || lastScrobbledAt === null}
						<span class="text-neutral-400 dark:text-neutral-600">—</span>
					{:else}
						{scrobbleDate.format(new Date(lastScrobbledAt))}
					{/if}
				</span>
			</p>
		</div>
	</div>



	<div
		class="relative left-1/2 col-span-full mt-4 w-screen -translate-x-1/2 overflow-hidden pb-4 lg:col-span-12 lg:mt-0"
		style={homeStyle(homeSettings)}
	>
		{#if nowQuery.isLoading}
			<div class="flex gap-3">
				{#each Array.from({ length: 20 }, (_, index) => index) as index (index)}
					<div class="now-cover shimmer aspect-square shrink-0"></div>
				{/each}
			</div>
		{:else if nowQuery.error != null}
			<div class="text-neutral-700 dark:text-neutral-300">
				<p>Couldn't load Now Listening</p>
				<div class="mt-1 text-neutral-500">{nowQuery.error.message ?? 'Unknown error'}</div>
			</div>
		{:else if tracks.length > 0}
			<div
				use:marqueePauseWhenOffscreen
				use:marqueeConstantSpeed
				class="now-marquee marquee-track flex"
			>
				{#each [...tracks, ...tracks] as track, i (i)}
					<a
						class="now-cover group relative aspect-square shrink-0 overflow-hidden shadow-md"
						href={track.url}
					>
						<div class="absolute inset-0 bg-neutral-200 dark:bg-neutral-800"></div>
						<img
							loading="lazy"
							src={track.image}
							alt={track.name || 'Album cover'}
							class="absolute inset-0 h-full w-full object-cover"
						/>
						<div
							class="now-cover-scrim absolute inset-0 transition-opacity duration-300 group-hover:opacity-0"
						></div>
						<div
							class="absolute inset-x-0 bottom-0 ml-1 p-2.5 transition-opacity duration-300 group-hover:opacity-0"
						>
							<p class="truncate text-sm leading-tight font-semibold text-white lg:text-base">
								{track.name}
							</p>
							<p class="truncate text-sm font-normal text-white/60 lg:text-base">
								{track.artist === 'Lany' ? 'LANY' : track.artist}
							</p>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- PHOTOS -->
<div
	id="photos"
	class="mt-20 mb-24 grid grid-cols-3 text-lg font-medium tracking-tight sm:grid-cols-5 sm:text-xl md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 flex flex-col justify-start md:col-span-10 lg:col-span-2">
		<div class="md:sticky md:top-24" style="height: max-content;">
			<a href="https://photos.injoon5.com" class="group">
				<h2
					class="text-xl font-medium tracking-tight text-neutral-900 group-hover:text-neutral-600 dark:text-neutral-100 dark:group-hover:text-neutral-400"
				>
					Photos
				</h2>
			</a>
		</div>
	</div>

	<div class="col-span-10 mt-4 justify-center lg:mt-0" style={homeStyle(homeSettings)}>
		<div class="photo-grid mt-1 grid grid-cols-2">
			{#if photosQuery.isLoading}
				{#each Array.from({ length: 6 }, (_, index) => index) as index (index)}
					<div class="shimmer aspect-square w-full"></div>
				{/each}
			{:else if photosQuery.error != null}
				<div class="col-span-2 sm:col-span-3">
					<div class="text-neutral-700 dark:text-neutral-300">
						<p>Couldn't load Photos</p>
						<div class="mt-1 text-neutral-500 dark:text-neutral-500">
							{photosQuery.error.message ?? 'Unknown error'}
						</div>
					</div>
				</div>
			{:else}
				{#each photos.slice(0, homeSettings.photoCount) as photo (photo.url)}
					<a
						href={photo.url}
						class="group relative block aspect-square w-full overflow-hidden shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:bg-neutral-900 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
					>
						<img
							loading="lazy"
							src={photo.image}
							alt={photo.title || 'Photo'}
							class="absolute inset-0 h-full w-full object-cover transitition-brightness duration-100 group-hover:brightness-70"
		
						/>

						<div
							class="absolute inset-x-0 bottom-0 p-2.5 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
						>
							<p class="tabular truncate text-sm text-white/30">
								{photo.takenAt}
							</p>
						</div>
					</a>
				{/each}
			{/if}
		</div>

		<div class="mt-2 flex justify-end">
			<a
				class="group relative inline-flex items-center text-base font-medium tracking-normal text-neutral-600 transition-colors duration-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100"
				href="https://photos.injoon5.com"
				target="_blank"
				rel="noopener noreferrer"
			>
				<span class="transition-transform duration-200 group-hover:-translate-x-5">
					View all Photos
				</span>
				<span
					class="absolute right-0 mr-1 translate-x-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
				>
					→
				</span>
			</a>
		</div>
	</div>
</div>

<!-- Preview deployments only, and compiled out entirely everywhere else. -->
<HomeDialsMount />

<style>
	/* The header's wordmark is this one's counterpoint — it arrives exactly as
	   this slides away behind the bar — and it gets there by reading this
	   element's own progress across the viewport rather than being told when to
	   start. Naming a view timeline here is the whole of that: `NavBar` binds an
	   animation to `--nav-hero-name`, `:root` carries the `timeline-scope` that
	   lets a name declared inside the page reach a header that is its sibling,
	   and no page but this one defines it, so no page but this one hands over.

	   The inset moves the edge the progress is measured against off the top of
	   the scrollport and onto the bottom of the header, which is where this name
	   actually goes out of sight. `auto` would have taken `scroll-padding-top`
	   instead — the anchor offset, which is deliberately 16px further down. */
	.hero-name {
		view-timeline-name: --nav-hero-name;
		view-timeline-inset: var(--nav-h) auto;
	}

	/* Each of these keeps the value the class used to hard-code as its fallback,
	   so the page renders identically when nothing sets the variable — which is
	   every production build. */
	.now-cover {
		width: var(--cover-size, 10rem);
		margin-right: var(--cover-gap, 0.75rem);
	}

	@media (min-width: 64rem) {
		.now-cover {
			width: var(--cover-size-lg, 12rem);
		}
	}

	/* Was `bg-gradient-to-t from-black/70 via-black/20`. Keeping the midpoint at
	   a fixed fraction of the floor holds the curve's shape as it is dialled. */
	.now-cover-scrim {
		background-image: linear-gradient(
			to top,
			rgb(0 0 0 / var(--cover-scrim, 0.7)),
			rgb(0 0 0 / calc(var(--cover-scrim, 0.7) * 0.29)),
			transparent
		);
	}

	.photo-grid {
		gap: var(--photo-gap, 1rem);
	}

	@media (min-width: 40rem) {
		.photo-grid {
			grid-template-columns: repeat(var(--photo-columns, 3), minmax(0, 1fr));
		}
	}

	.now-marquee {
		width: max-content;
		will-change: transform;
		animation: now-scroll linear infinite;
		animation-duration: 60s; /* overridden by marqueeConstantSpeed action */
		animation-play-state: var(--marquee-play-state, running);
	}
	@keyframes now-scroll {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}
</style>

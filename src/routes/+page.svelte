<script>
	import { onMount, onDestroy } from 'svelte';
	import { heroNameVisible } from '$lib/heroNav.js';

	// The hero shows the big "Injoon Oh"; once it scrolls out of view the navbar
	// name fades in (see NavBar). An IntersectionObserver drives the handoff so
	// there's no per-frame scroll math.
	let heroNameEl;
	let heroObserver;

	// LoadState: 'loading' | 'ready' | 'error'
	let nowlistening = null;
	let photos = null;

	let nowState = 'loading';
	let photosState = 'loading';

	let nowError = null;
	let photosError = null;

	function marqueePauseWhenOffscreen(node) {
		const io = new IntersectionObserver(
			([entry]) => {
				node.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused';
			},
			{ threshold: 0 }
		);
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}

	// Drive marquee duration by scroll-distance, not track count, so it always
	// moves at ~40px/s regardless of how many albums are loaded.
	function marqueeConstantSpeed(node) {
		const PX_PER_SECOND = 40;
		function tune() {
			// Track list is duplicated; we translate by -50%, so the distance
			// travelled equals half the full scrollWidth.
			const distance = node.scrollWidth / 2;
			if (distance <= 0) return;
			const seconds = distance / PX_PER_SECOND;
			node.style.animationDuration = `${seconds}s`;
		}
		// Wait for images to settle so scrollWidth is final.
		const imgs = node.querySelectorAll('img');
		let pending = imgs.length;
		const done = () => {
			pending--;
			if (pending <= 0) tune();
		};
		imgs.forEach((img) => {
			if (img.complete) done();
			else {
				img.addEventListener('load', done, { once: true });
				img.addEventListener('error', done, { once: true });
			}
		});
		tune();
		const ro = new ResizeObserver(tune);
		ro.observe(node);
		return { destroy: () => ro.disconnect() };
	}

	onMount(async () => {
		// Flip once the hero name passes behind the ~64px-tall sticky nav, so the
		// navbar name fades in right as the hero tucks away.
		heroObserver = new IntersectionObserver(
			([entry]) => heroNameVisible.set(entry.isIntersecting),
			{ rootMargin: '-64px 0px 0px 0px', threshold: 0 }
		);
		if (heroNameEl) heroObserver.observe(heroNameEl);

		nowState = 'loading';
		photosState = 'loading';
		nowError = null;
		photosError = null;

		const loadPhotos = fetch(`https://raw.githubusercontent.com/injoon5/data/main/photos.json`)
			.then(async (r) => {
				if (!r.ok) throw new Error(`photos.json HTTP ${r.status}`);
				return r.json();
			})
			.then((j) => {
				photos = j;
				photosState = 'ready';
			})
			.catch((e) => {
				photosState = 'error';
				photosError = e?.message ?? 'Failed to load photos';
			});

		const loadNow = fetch(`https://raw.githubusercontent.com/injoon5/data/main/now-playing.json`)
			.then(async (r) => {
				if (!r.ok) throw new Error(`now-playing.json HTTP ${r.status}`);
				return r.json();
			})
			.then((j) => {
				nowlistening = j;
				nowState = 'ready';
			})
			.catch((e) => {
				nowState = 'error';
				nowError = e?.message ?? 'Failed to load now playing';
			});

		await Promise.allSettled([loadPhotos, loadNow]);
	});

	onDestroy(() => {
		heroObserver?.disconnect();
		heroNameVisible.set(true);
	});

	export let data;
</script>

<svelte:head>
	<title>Injoon Oh</title>
	<meta charset="UTF-8" />
	<meta property="og:title" content="Injoon Oh" />
	<meta name="description" content="A student who is interested in math, science, and computers." />
	<meta property="og:description" content="A student who is interested in math, science, and computers." />
	<meta
		property="og:image"
		content="https://og.ij5.dev/api/og/?title=injoon5.com&subheading=Injoon+Oh"
	/>

	<meta property="og:url" content="https://www.injoon5.com/" />
</svelte:head>

<div
	id="introduction"
	class="mt-20 mb-12 grid grid-cols-3 text-base font-[450] tracking-normal sm:grid-cols-5 sm:text-normal md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 flex flex-col justify-start md:col-span-10 lg:col-span-2">
		<div style="height: max-content;">
			<h2
			class="text-2xl -mb-1 font-semibold font-sans tracking-tight text-neutral-400 dark:text-neutral-500 text-balance"
		>
			오인준
		</h2>
			<h2
				bind:this={heroNameEl}
				class="text-2xl font-medium font-sans tracking-tight text-neutral-900 dark:text-neutral-100 text-balance"
			>
Injoon Oh
			</h2>
		</div>
	</div>
	<div class="col-span-5 mt-4 justify-center md:mr-2 lg:mt-0">
		<p class="mb-4 text-neutral-900 dark:text-neutral-100 text-pretty">
			I am a student who is interested in math, science, and computers.
		</p>
		<p class="text-neutral-900 dark:text-neutral-100 text-pretty">
			I love exploring new concepts and getting to know cool new things. Whether it's tackling
			complex equations, researching about scientific stuff, or trying the latest tech, I'm always
			eager to learn.
		</p>
	</div>
	<div class="col-span-5 mt-4 justify-center md:ml-2 lg:mt-0">
		<p class="mb-2 text-neutral-900 dark:text-neutral-100 text-pretty">
			Although I haven't decided the specific domain due to the industry evolving so rapidly, I want
			to be a computer programmer when I grow up. <s class="text-neutral-500"
				>(Nowadays I'm thinking about AI, but who knows?)</s
			>
		</p>
	</div>
</div>
<div
	id="blog"
	class="mt-20 mb-12 grid grid-cols-3 text-lg tracking-tight sm:grid-cols-5 sm:text-xl md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 flex flex-col justify-start md:col-span-10 lg:col-span-2">
		<div class="top-20 md:sticky md:top-24" style="height: max-content;">
			<a href="/blog" class="group">
				<h2
					class="mb-4 text-xl font-medium tracking-tight text-neutral-900 group-hover:text-neutral-600 dark:text-neutral-100 dark:group-hover:text-neutral-400 text-balance"
				>
					Blog
				</h2>
			</a>
		</div>
	</div>
	<div class="col-span-10 justify-center lg:mt-0">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each data.posts.slice(0, 5) as post}
				<a
					class="group flex flex-col gap-1 bg-neutral-100 px-4 py-3 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
					href="/blog/{post.slug}"
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
							'Some amazing post that I forgot or failed to write a description for. '}
					</p>
					<div class="flex items-center gap-2 text-sm font-medium text-neutral-500 dark:text-neutral-500">
						<span class="whitespace-nowrap">{post.date || post.year}</span>
						{#if post.hasEn}
							<span class="text-sm font-semibold text-neutral-400 dark:text-neutral-600">English</span>
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
					class="mb-4 text-xl font-medium tracking-tight text-neutral-900 group-hover:text-neutral-600 dark:text-neutral-100 dark:group-hover:text-neutral-400 text-balance"
				>
					Projects
				</h2>
			</a>
		</div>
	</div>
	<div class="col-span-10 justify-center lg:mt-0">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each data.projects.slice(0, 5) as post}
				<a
					class="group flex flex-col gap-1 bg-neutral-100 px-4 py-3 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
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
						class="whitespace-nowrap text-sm font-medium text-neutral-500 dark:text-neutral-500"
					>
						{post.date || post.year}
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
		<div class="mt-4 justify-center md:mr-2 lg:mt-0">
			<div class="space-y-10">
				{#each data.techstack as stacks}
					<div>
						<h3 class="text-base font-medium tracking-tight text-neutral-900 dark:text-neutral-100 mt-0.5">
							{stacks.name}
						</h3>
						<div class="mt-4 grid grid-cols-4 gap-4 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-12">
							{#each stacks.technologies as technology}
								<div class="col-span-4 mt-2">
									<p class="tracking-tight text-sm leading-normal font-medium text-neutral-900 dark:text-neutral-100">
										{technology.name}
									</p>
									<p
										class="tracking-tight text-sm leading-normal font-medium text-neutral-600 dark:text-neutral-400"
									>
										{technology.description}
									</p>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.now-marquee {
		width: max-content;
		will-change: transform;
		animation: now-scroll linear infinite;
		animation-duration: 60s; /* overridden by marqueeConstantSpeed action */
		animation-play-state: var(--marquee-play-state, running);
	}
	@keyframes now-scroll {
		from { transform: translateX(0); }
		to   { transform: translateX(-50%); }
	}
</style>

<!-- <div id="tech-stack" class="mb-12">
	<h2 class="flex justify-between text-xl font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
		Tech Stack
	</h2>
	<div class="mt-4">
		<div class="flex flex-wrap gap-2">
			{#each data.techstack as stack}
				<div class="text-neutral-900 dark:text-neutral-400 flex items-center justify-center">
					<p class="font-light text-lg">{stack.name}</p>
				</div>
				{#each stack.technologies as technology}
					<a href={technology.link} target="_blank" rel="noopener noreferrer" class="rounded-xl bg-neutral-50 px-3 py-2 dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors duration-200">
						<p class="text-sm">{technology.name}</p>
					</a>
				{/each}
			{/each}
		</div>
	</div>
</div> -->


<div
	id="now-listening"
	class="mt-20 mb-12 grid grid-cols-3 text-lg font-medium tracking-tight sm:grid-cols-5 sm:text-xl md:grid-cols-10 lg:relative lg:grid-cols-12"
>
	<div class="col-span-3 flex flex-col justify-start md:col-span-10 lg:absolute lg:z-10 lg:top-0 lg:left-0">
		<div class="md:sticky md:top-24 lg:static" style="height: max-content;">
			<h2 class="lg:mt-1 text-xl font-medium tracking-tight text-neutral-900 dark:text-neutral-100 lg:text-white text-balance lg:[text-shadow:0_1px_4px_rgba(0,0,0,1),0_2px_16px_rgba(0,0,0,0.9),0_4px_48px_rgba(0,0,0,0.8)]">
				Now Listening
			</h2>
			<p class="text-sm leading-tight font-medium text-neutral-500 dark:text-neutral-500 lg:text-white dark:lg:text-white lg:opacity-70 dark:lg:opacity-70 lg:[text-shadow:0_1px_4px_rgba(0,0,0,1),0_2px_16px_rgba(0,0,0,0.9),0_4px_48px_rgba(0,0,0,0.8)]">
				Last updated on
				<span class="inline lg:block">
					{#if nowState === 'loading'}
						<span class="inline-flex items-center gap-2"> Loading… </span>
					{:else if nowState === 'error'}
						<span class="text-neutral-400 dark:text-neutral-600">—</span>
					{:else}
						{nowlistening?.recenttracks?.track?.[
							nowlistening?.recenttracks?.track?.[0]?.['@attr']?.nowplaying === 'true' ? 1 : 0
						]?.date?.['#text']?.slice(0, 11) ?? '—'}
					{/if}
				</span>
			</p>
		</div>
	</div>


	<div
		class="relative col-span-10 mt-4 overflow-hidden sm:-mx-12 lg:mx-0 lg:col-span-12 lg:w-screen lg:left-1/2 lg:right-1/2 lg:-translate-x-1/2 lg:relative lg:mt-0 pb-4 "
	>
		{#if nowState === 'loading'}
			<div class="flex gap-3">
				{#each Array(6) as _}
					<div class="shimmer aspect-square w-40 shrink-0 lg:w-48 rounded-xl"></div>
				{/each}
			</div>
		{:else if nowState === 'error'}
			<div class="text-neutral-700 dark:text-neutral-300">
				<p>Couldn't load Now Listening</p>
				<div class="mt-1 text-neutral-500">{nowError ?? 'Unknown error'}</div>
			</div>
		{:else if (nowlistening?.recenttracks?.track ?? []).length > 0}
			<div
				use:marqueePauseWhenOffscreen
				use:marqueeConstantSpeed
				class="now-marquee marquee-track flex"
			>
				{#each [...(nowlistening?.recenttracks?.track ?? []), ...(nowlistening?.recenttracks?.track ?? [])] as track}
					<a
						class=" border dark:border shadow-md border-neutral-300 dark:border-neutral-800 border-opacity-50 group relative aspect-square w-40 shrink-0 lg:w-48 overflow-hidden rounded-2xl mr-3"
						href={track.url}
					>
						<div class="absolute inset-0 bg-neutral-200 dark:bg-neutral-800"></div>
						<img
							loading="lazy"
							src={track?.image?.[2]?.['#text'] ?? ''}
							alt={track?.name ?? 'Album cover'}
							class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
						/>
						<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-300 group-hover:opacity-0"></div>
						<div class="ml-1 absolute inset-x-0 bottom-0 p-2.5 transition-opacity duration-300 group-hover:opacity-0">
							<p class="truncate text-sm font-semibold leading-tight text-white lg:text-base">
								{track.name}
							</p>
							<p class="truncate text-sm font-normal text-white/60 lg:text-base">
								{track?.artist?.['#text'] === 'Lany' ? 'LANY' : track?.artist?.['#text']}
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

	<div class="col-span-10 mt-4 justify-center lg:mt-0">
		<div class="mt-1 grid grid-cols-2 gap-4 sm:grid-cols-3">
			{#if photosState === 'loading'}
				{#each Array(6) as _}
					<div class="shimmer aspect-square w-full"></div>
				{/each}
			{:else if photosState === 'error'}
				<div class="col-span-2 sm:col-span-3">
					<div class="text-neutral-700 dark:text-neutral-300">
						<p>Couldn't load Photos</p>
						<div class="mt-1 text-neutral-500 dark:text-neutral-500">
							{photosError ?? 'Unknown error'}
						</div>
					</div>
				</div>
			{:else}
				{#each (photos?.photos ?? []).slice(0, 6) as photo}
					<a
						href={photo.url}
						class="group border rounded-xl border-neutral-300 dark:border-neutral-800 border-opacity-50 relative block aspect-square w-full overflow-hidden bg-neutral-100 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:bg-neutral-900 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
					>
						<img
							loading="lazy"
							src={photo?.src?.medium?.url ?? ''}
							alt={photo?.title || 'Photo'}
							class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
						/>

						<div
							class="absolute inset-x-0 bottom-0 p-2.5 transition-opacity duration-300 group-hover:opacity-0"
						>
							<p class="truncate text-sm font-medium text-white/30 tabular">
								{photo.takenAtNaive}
							</p>
						</div>
					</a>
				{/each}
			{/if}
		</div>

		<div class="mt-2 mb-4 flex justify-end">
			<a
				class="group relative inline-flex items-center text-base font-medium -tracking-normal text-neutral-600 transition-colors duration-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100"
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
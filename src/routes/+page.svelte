<script lang="ts">
	import { sliceText } from '$lib/utils';
	import { onMount } from 'svelte';

	type LoadState = 'loading' | 'ready' | 'error';

	let nowlistening: any = null;
	let photos: any = null;

	let nowState: LoadState = 'loading';
	let photosState: LoadState = 'loading';

	let nowError: string | null = null;
	let photosError: string | null = null;

	onMount(async () => {
		nowState = 'loading';
		photosState = 'loading';
		nowError = null;
		photosError = null;

		const loadPhotos = fetch(`https://raw.githubusercontent.com/injoon5/data/main/photos.json`, {
			cache: 'no-store'
		})
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

		const loadNow = fetch(`https://raw.githubusercontent.com/injoon5/data/main/now-playing.json`, {
			cache: 'no-store'
		})
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

	export let data;
</script>

<svelte:head>
	<title>Injoon Oh</title>
	<meta charset="UTF-8" />
	<meta property="og:title" content="Injoon Oh" />
	<meta name="description" content="A student who is interested in math, science, and computers." />
	<meta
		property="og:image"
		content="https://og.ij5.dev/api/og/?title=injoon5.com&subheading=injoon5%27s+website"
	/>

	<meta property="og:url" content="https://www.injoon5.com/" />
</svelte:head>

<div
	id="introduction"
	class="mt-20 mb-12 grid grid-cols-3 text-lg font-medium tracking-tight sm:grid-cols-5 sm:text-xl md:grid-cols-10 lg:grid-cols-12"
>
	<div class=" col-span-3 flex flex-col justify-start md:col-span-10 lg:col-span-2">
		<div class="md:sticky md:top-28" style="height: max-content;">
			<h2 class="text-xl font-medium tracking-tight text-neutral-900 italic dark:text-neutral-100">
				Hello! -
			</h2>
		</div>
	</div>
	<div class="col-span-5 mt-4 justify-center md:mr-2 lg:mt-0">
		<p class="mb-4 text-neutral-900 dark:text-neutral-100">
			I am a student who is interested in math, science, and computers.
		</p>
		<p class=" text-neutral-900 dark:text-neutral-100">
			I love exploring new concepts and getting to know cool new things. Whether it’s tackling
			complex equations, researching about scientific stuff, or trying the latest tech, I’m always
			eager to learn.
		</p>
	</div>
	<div class="col-span-5 mt-4 justify-center md:ml-2 lg:mt-0">
		<p class="mb-2 text-neutral-900 dark:text-neutral-100">
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
					class="mb-4 text-xl font-medium tracking-tight text-neutral-900 group-hover:text-neutral-600 dark:text-neutral-100 dark:group-hover:text-neutral-400"
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
						class="font-neutral-900 dark:font-neutral-100 line-clamp-1 text-base font-semibold group-hover:underline"
					>
						{post.title}
					</h3>
					<p
						class="mb-1 line-clamp-2 max-h-[2lh] min-h-[2lh] text-base font-medium break-keep text-neutral-600 dark:text-neutral-400"
					>
						{post.description ||
							'Some amazing post that I forgot or failed to write a description for. '}
					</p>
					<div
						class="neutral-100 space-nowrap text-sm font-semibold text-neutral-500 dark:text-neutral-500"
					>
						{post.date || post.year}
					</div>
				</a>
			{/each}
		</div>
		<div class="mt-2 mb-4 flex justify-end">
			<a
				class="group relative inline-flex items-center text-base font-medium -tracking-normal text-neutral-600 transition-colors duration-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100"
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
			<a href="/blog" class="group">
				<h2
					class="mb-4 text-xl font-medium tracking-tight text-neutral-900 group-hover:text-neutral-600 dark:text-neutral-100 dark:group-hover:text-neutral-400"
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
						class="font-neutral-900 dark:font-neutral-100 line-clamp-1 text-base font-semibold group-hover:underline"
					>
						{post.title}
					</h3>
					<p
						class="mb-1 line-clamp-2 max-h-[2lh] min-h-[2lh] text-base font-medium break-keep text-neutral-600 dark:text-neutral-400"
					>
						{post.description ||
							'Some amazing project that I forgot or failed to write a description for. '}
					</p>
					<div
						class="neutral-100 space-nowrap text-sm font-semibold text-neutral-500 dark:text-neutral-500"
					>
						{post.date || post.year}
					</div>
				</a>
			{/each}
		</div>
		<div class="mt-2 mb-4 flex justify-end">
			<a
				class="group relative inline-flex items-center text-base font-medium -tracking-normal text-neutral-600 transition-colors duration-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100"
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
						<h3 class="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
							{stacks.name}
						</h3>
						<div class="mt-4 grid grid-cols-4 gap-4 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-12">
							{#each stacks.technologies as technology}
								<div class="col-span-4 mt-2">
									<p class="text-base font-semibold text-neutral-900 dark:text-neutral-200">
										{technology.name}
									</p>
									<p
										class="tracking-tigh text-base leading-normal font-medium text-neutral-600 dark:text-neutral-400"
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
	class="mt-20 mb-56 grid grid-cols-3 text-lg font-medium tracking-tight sm:grid-cols-5 sm:text-xl md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 flex flex-col justify-start md:col-span-10 lg:col-span-2">
		<div class="md:sticky md:top-24" style="height: max-content;">
			<h2 class="text-xl font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
				Now Listening
			</h2>
			<p class="text-sm leading-tight font-medium text-neutral-500 dark:text-neutral-500">
				Last updated at
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

	<div class="col-span-10 mt-4 justify-center lg:-mt-1 lg:-mb-1.5">
		<div class="grid grid-cols-1 divide-y divide-neutral-200 dark:divide-neutral-700">
			{#if nowState === 'loading'}
				{#each Array(4) as _}
					<div class="flex items-center gap-3 py-2">
						<div class="relative h-14 w-14 shrink-0 overflow-hidden">
							<div class="absolute inset-0 animate-pulse bg-neutral-200 dark:bg-neutral-800"></div>
						</div>
						<div class="flex w-full items-center justify-between">
							<div class="h-5 w-2/3 animate-pulse bg-neutral-200 dark:bg-neutral-800"></div>
							<div class="ml-2 h-5 w-1/4 animate-pulse bg-neutral-200 dark:bg-neutral-800"></div>
						</div>
					</div>
				{/each}
			{:else if nowState === 'error'}
				<div class=" text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
					<p>Couldn’t load Now Listening</p>
					<div class="mt-1 text-neutral-500 dark:text-neutral-500">
						{nowError ?? 'Unknown error'}
					</div>
				</div>
			{:else}
				{#each (nowlistening?.recenttracks?.track ?? []).slice(0, 4) as track}
					<a
						class="group flex items-center gap-3 py-2 text-neutral-900 hover:text-neutral-600 dark:text-neutral-100 dark:hover:text-neutral-400"
						href={track.url}
					>
						<div class="shrink-0">
							<div class="relative h-14 w-14">
								<div class="absolute inset-0 bg-neutral-200 dark:bg-neutral-800"></div>
								<img
									loading="lazy"
									src={track?.image?.[2]?.['#text'] ?? ''}
									alt={sliceText(track?.name ?? '', 10)}
									class="absolute inset-0 h-full w-full object-cover"
								/>
							</div>
						</div>
						<div class="flex w-full items-center justify-between text-lg font-medium">
							<span class="line-clamp-1">{track.name}</span>
							<span class="ml-2 line-clamp-1">
								{track?.artist?.['#text'] === 'Lany' ? 'LANY' : track?.artist?.['#text']}
							</span>
						</div>
					</a>
				{/each}
			{/if}
		</div>
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
					<div
						class="relative flex aspect-square w-full items-center justify-center overflow-hidden"
					>
						<div class="absolute inset-0 animate-pulse bg-neutral-100 dark:bg-neutral-900"></div>
						<div class="z-10 h-2/3 w-2/3 animate-pulse bg-neutral-200 dark:bg-neutral-800"></div>
					</div>
				{/each}
			{:else if photosState === 'error'}
				<div class="col-span-2 sm:col-span-3">
					<div class=" text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
						<p>Couldn’t load Photos</p>
						<div class="mt-1 text-neutral-500 dark:text-neutral-500">
							{photosError ?? 'Unknown error'}
						</div>
					</div>
				</div>
			{:else}
				{#each (photos?.photos ?? []).slice(0, 6) as photo}
					<div
						class="group relative flex aspect-square w-full items-center justify-center overflow-hidden"
					>
						<div
							class="absolute inset-0 bg-neutral-100 group-hover:bg-neutral-200 dark:bg-neutral-900 dark:group-hover:bg-neutral-800"
						></div>

						<a
							href={photo.url}
							class="photo-item relative flex h-full w-full items-center justify-center"
						>
							<img
								loading="lazy"
								src={photo?.src?.medium?.url ?? ''}
								alt={photo?.title || 'Photo'}
								class="z-10 max-h-[80%] max-w-[80%] object-contain shadow-lg"
							/>

							{#if (photo?.src?.medium?.width ?? 0) >= (photo?.src?.medium?.height ?? 0)}
								<span
									class="absolute bottom-1 z-20 px-1 py-1 text-xs font-normal text-neutral-300 opacity-0 md:opacity-100 dark:text-neutral-700"
								>
									{photo.takenAtNaive}
								</span>
							{:else}
								<span
									class="absolute right-1 z-20 px-1 py-1 text-xs font-normal text-neutral-300 opacity-0 md:opacity-100 dark:text-neutral-700"
									style="writing-mode: vertical-rl; transform: rotate(180deg);"
								>
									{photo.takenAtNaive}
								</span>
							{/if}
						</a>
					</div>
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

<script lang="ts">
	import PostLink from '$lib/PostLink.svelte';
	import { onMount } from 'svelte';
	import { formatDate, sliceText } from '$lib/utils';

	export let data;
</script>

<svelte:head>
	<title>Injoon Oh</title>
	<meta charset="UTF-8" />
	<meta property="og:title" content="Injoon Oh" />
	<meta
		name="description"
		content="Welcome to Injoon Oh's digital playground: Aspiring coder, Interested in Math and Science. Probably plotting world domination via AI. Or homework."
	/>
	<meta
		property="og:image"
		content="https://og.ij5.dev/api/og/?title=injoon5.com&subheading=injoon5%27s+website"
	/>
	<meta property="og:url" content="https://www.injoon5.com/" />
</svelte:head>

<div id="introduction" class="mb-12 mt-20 text-base">
	<h1 class="mb-4 font-serif text-2xl text-black md:text-3xl dark:text-white">Injoon Oh</h1>
	<p class="mb-2 text-black dark:text-white">
		I am a student who is interested in math, science, and computers.
	</p>
	<p class="mb-2 text-black dark:text-white">
		I love exploring new concepts and getting to know cool new things. Whether it’s tackling complex
		equations, researching about scientific stuff, or trying the latest tech, I’m always eager to
		learn.
	</p>
	<p class="mb-2 text-black dark:text-white">
		Although I haven't decided the specific domain due to the industry evolving so rapidly, I want
		to be a computer programmer when I grow up. <s
			>(Nowadays I'm thinking about AI, but who knows?)</s
		>
	</p>
</div>

<div id="blog-posts" class="mb-12">
	<h2 class="flex justify-between font-serif text-xl text-black dark:text-white">
		Blog
		<div>
			<a class="font-sans text-sm text-black hover:underline dark:text-white" href="/blog"
				>Read all posts</a
			>
		</div>
	</h2>
	{#each data.posts.slice(0, 4) as post}
		<PostLink data={post} slug="blog" />
	{/each}
</div>

<div id="projects" class="mb-12">
	<h2 class="flex justify-between font-serif text-xl text-black dark:text-white">
		Projects
		<div>
			<a class="font-sans text-sm text-black hover:underline dark:text-white" href="/projects"
				>View all Projects</a
			>
		</div>
	</h2>
	{#each data.projects.slice(0, 4) as project}
		<PostLink data={project} slug="projects" />
	{/each}
</div>

<div id="now-listening">
	<h2 class="font-serif text-xl text-black dark:text-white">Now Listening</h2>
	<div class="grid grid-cols-4 gap-4 pb-4 sm:grid-cols-4">
		{#each data.nowlistening.recenttracks.track.slice(0, 4) as nowlistening}
			<a
				class="flex items-center gap-1 pt-4 text-black hover:text-gray-600 dark:text-white dark:hover:text-gray-200"
				href={nowlistening.url}
			>
				<div class="album-item">
					<img
						loading="lazy"
						src={nowlistening.image[2]['#text']}
						alt={sliceText(nowlistening.name, 10)}
						class="h-auto w-full rounded shadow-md"
					/>
					<div class="mt-2 justify-start text-left text-sm">
						<p class="line-clamp-1">{nowlistening.name}</p>
						<p class="line-clamp-1 font-light">{nowlistening.artist['#text']}</p>
					</div>
				</div>
			</a>
		{/each}
	</div>
</div>

<style>
	.album-item {
		transition: transform 0.3s;
	}
	.album-item:hover {
		transform: scale(1.05);
	}
</style>

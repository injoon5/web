<script lang="ts">
	import HoverLink from '$lib/HoverLink.svelte';

	import { onMount } from 'svelte';
	import { formatDate, sliceText } from '$lib/utils';

	export let data;
</script>

<svelte:head>
	<title>Blog - Injoon Oh</title>
</svelte:head>

<h1 class="mt-16 text-3xl font-semibold tracking-tighter text-primary-50 md:text-4xl">Blog</h1>

<div class="relative mt-7 flex snap-x snap-mandatory scroll-mr-6 overflow-x-auto text-primary-50">
	{#each data.posts.slice(0, 3) as post}
		<div
			class="max-w-[344px] shrink-0 flex-grow-0 snap-start rounded-2xl bg-primary-800 p-6 sm:max-w-sm"
		>
			<h2 class="text-pretty text-2xl font-semibold text-primary-50">
				{sliceText(post.title, 10)}
			</h2>
			<h3 class="truncate text-pretty text-lg font-medium text-primary-200">
				{sliceText(post.date, 100)}
			</h3>
			<img class="mt-4 h-48 w-96 rounded-lg object-cover" src="https://picsum.photos/500/1000" />
			<h3 class="mt-2 text-lg font-medium text-primary-300">{sliceText(post.description, 30)}</h3>
		</div>
	{/each}
</div>

<div class="mt-6 grid w-full grid-cols-1 text-xl text-primary-50">
	{#each data.posts.slice(3) as post}
		<div
			class="flex items-center justify-between justify-items-stretch border-t border-t-primary-600 py-3 md:border-t-2"
		>
			<HoverLink>
				<a
					href="/blog/{post.slug}"
					class="flex flex-auto justify-self-start text-base font-medium text-primary-50 md:text-lg"
					>{sliceText(post.title, 10)}</a
				>
			</HoverLink>
			<time class="justify-self-end text-base font-normal text-primary-400 md:text-lg"
				>{formatDate(post.date)}</time
			>
		</div>
	{/each}
</div>

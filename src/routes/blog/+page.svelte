<script lang="ts">
	import WhiteText from '$lib/WhiteText.svelte';
	import HoverLink from '$lib/HoverLink.svelte';
	import Balancer from '$lib/Balancer.svelte';
	import { onMount } from 'svelte';
	import { formatDate, sliceText } from '$lib/utils';

	export let data;
</script>

<svelte:head>
	<title>Blog - Injoon Oh</title>
</svelte:head>

<h1 class="text-primary-50 mt-16 text-3xl font-semibold tracking-tighter md:text-4xl">Blog</h1>

<div class="text-primary-50 mt-10 grid w-full grid-cols-1 text-xl">
	{#each data.posts.slice(0, 4) as post}
		<div
			class="border-t-primary-600 flex items-center justify-between justify-items-stretch border-t py-3 md:border-t-2"
		>
			<HoverLink>
				<a
					href="/blog/{post.slug}"
					class="text-primary-50 flex flex-auto justify-self-start text-base font-medium md:text-lg"
					>{sliceText(post.title, 10)}</a
				>
			</HoverLink>
			<time class="text-primary-400 justify-self-end text-base font-normal md:text-lg"
				>{formatDate(post.date)}</time
			>
		</div>
	{/each}
</div>

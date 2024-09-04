<script lang="ts">
	import PostLink from '$lib/PostLink.svelte';

	import { onMount } from 'svelte';
	import { formatDate, sliceText } from '$lib/utils';

	export let data;

	let renderedPosts = [];
</script>

<svelte:head>
	<title>Blog - Injoon Oh</title>
</svelte:head>

<h1 class="mt-20 font-serif text-2xl font-normal text-black dark:text-white">Blog</h1>
<h2 class="text-md font-normal text-black dark:text-white">
	Stuff that just made it online. Take a look at my terrible writing skills.
</h2>

<div class="my-6 text-sm">
	{#each data.posts as post}
		{#if post.series && !renderedPosts.includes(post.series) && renderedPosts.push(post.series)}
			<p class="-mb-1 mt-4 font-semibold">Series: {post.series}</p>
			<div class="ml-5">
				{#each data.posts
					.filter((sameseries) => sameseries.series === post.series)
					.reverse() as same_series_post}
					<PostLink data={same_series_post} slug="blog" />
				{/each}
			</div>
		{:else if !post.series}
			<PostLink data={post} slug="blog" />
		{/if}
	{/each}
</div>

<script lang="ts">
	import HoverLink from '$lib/HoverLink.svelte';
	import PostLink from '$lib/PostLink.svelte';

	import { onMount } from 'svelte';
	import { formatDate, sliceText } from '$lib/utils';

	export let data;
</script>

<svelte:head>
	<title>Blog - Injoon Oh</title>
</svelte:head>

<h1 class="text-black dark:text-white font-serif text-2xl font-normal mt-20">Blog</h1>
<h2 class="text-black dark:text-white text-md font-normal">Stuff that just made it online. Take a look at my terrible writing skills. </h2>

<div class="my-6 text-sm">
	{#each data.posts as post}
		<PostLink data={post} slug="blog"/>
	{/each}
</div>

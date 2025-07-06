<script lang="ts">
	import PostLink from '$lib/PostLink.svelte';

	import { onMount } from 'svelte';
	import { formatDate, sliceText } from '$lib/utils';

	export let data;
</script>

<svelte:head>
	<title>Projects - Injoon Oh</title>
</svelte:head>

<h1 class="mt-20 text-2xl font-normal tracking-tight text-black dark:text-white">Projects</h1>
<h2 class="text-md font-normal tracking-tight text-black dark:text-white">
	Some of the stuff I did to escape from a boring day. (Not fully written yet)
</h2>

<div class="my-6 text-sm">
	{#each data.projects as post}
		<PostLink data={post} slug="projects" />
	{/each}
</div>

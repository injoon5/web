<script lang="ts">
	import HoverLink from '$lib/HoverLink.svelte';
	import PostLink from '$lib/PostLink.svelte';

	import { onMount } from 'svelte';
	import { formatDate, sliceText } from '$lib/utils';

	export let data;
</script>

<svelte:head>
	<title>Projects - Injoon Oh</title>
</svelte:head>

<h1 class="text-black dark:text-white font-serif text-2xl font-normal mt-20">Projects</h1>
<h2 class="text-black dark:text-white font-serif text-md font-normal">Some of the stuff I did to escape from a boring day. </h2>

<div class="my-6 text-sm">
	{#each data.projects as post}
		<PostLink data={post} slug="projects"/>
	{/each}
</div>

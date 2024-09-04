<script lang="ts">
	import { formatDate } from '$lib/utils';
	import SeriesList from '$lib/SeriesList.svelte';
	import CommentsSection from '$lib/comments/CommentsSection.svelte';
	import LikeButton from '$lib/LikeButton.svelte';

	import Readotron from '@untemps/svelte-readotron';

	export let data;
</script>

<!-- SEO -->
<svelte:head>
	<title>{data.meta.title} - Projects</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content="{data.meta.title} - Projects" />
</svelte:head>

<article class="pt-10">
	<!-- Title -->
	<div class="tracking-tight">
		<h1 class="text-3xl font-semibold tracking-tight md:text-3xl md:font-semibold">
			{data.meta.title}
		</h1>
		<div class="flex flex-row text-xl text-neutral-600 dark:text-neutral-300">
			<p>{data.meta.year}</p>
			<p class="mx-1">·</p>
			<Readotron selector=".readtime" lang="ar" />
		</div>
		<div class="tags space-x-2 text-lg">
			<span>Made with:</span>
			{#each data.meta.tags as tags}
				<span>{tags}</span>
			{/each}
		</div>
		<p class="-mt-2 text-lg">
			{data.meta.description}
		</p>

		<div class="my-2">
			<LikeButton />
		</div>
	</div>

	<div class="tracking-tight"></div>

	<!-- Tags -->

	<!-- Post -->
	<div
		class="readtime prose-primary prose-em:text-primary-100 prose-img:-pt-10 prose-em:-pt-20 prose prose-invert mt-10 max-w-none md:prose-lg prose-a:no-underline hover:prose-a:underline prose-img:mx-auto prose-img:rounded"
	>
		<svelte:component this={data.content} class="prose" />
	</div>
</article>

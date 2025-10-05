<script lang="ts">
	import { formatDate } from '$lib/utils';
	import SeriesList from '$lib/SeriesList.svelte';
	import CommentsSection from '$lib/comments/CommentsSection.svelte';
	import LikeButton from '$lib/LikeButton.svelte';

	import Readotron from '@untemps/svelte-readotron';

	export let data;

	$: ogImageUrl = `https://og.ij5.dev/api/og/?title=${encodeURIComponent(data.meta.title)}&subheading=${encodeURIComponent(formatDate(data.meta.year))}`;
</script>

<!-- SEO -->
<svelte:head>
	<title>{data.meta.title} - Projects</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content="{data.meta.title} - Projects" />
	<meta property="og:image" content={ogImageUrl} />
</svelte:head>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
	<article class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
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
			<p class="text-lg font-light">
				{data.meta.description}
			</p>
			<div class="tags -mt-1 mb-2 space-x-2 text-lg font-light">
				<span class="-mr-1">Stack:</span>
				{#each data.meta.tags as tags}
					<span>{tags}</span>
				{/each}
			</div>

			<div class="my-2">
				<LikeButton />
			</div>
		</div>

		<div class="tracking-tight"></div>

		<!-- Tags -->

		<!-- Post -->
		<div
			class="readtime prose-neutral prose-em:text-neutral-100 prose-img:-pt-10 prose-em:-pt-20 prose dark:prose-invert mt-10 max-w-none md:prose-lg prose-a:no-underline hover:prose-a:underline prose-img:mx-auto prose-img:rounded"
		>
			<svelte:component this={data.content} class="prose" />
		</div>
	</article>
</div>

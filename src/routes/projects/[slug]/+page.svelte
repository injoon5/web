<script lang="ts">
	import { formatDate } from '$lib/utils';
	import LikeButton from '$lib/LikeButton.svelte';
	import Readotron from '@untemps/svelte-readotron';

	export let data;
	export const prerender = false;

	$: ogImageUrl = `https://og.ij5.dev/api/og/?title=${encodeURIComponent(data.meta.title)}&subheading=${encodeURIComponent(formatDate(data.meta.year))}`;
</script>

<svelte:head>
	<title>{data.meta.title}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={data.meta.title} />
	<meta property="og:image" content={ogImageUrl} />
</svelte:head>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
	<article class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
		<div class="tracking-tight">
			<h1 class="text-3xl font-semibold tracking-tight md:font-semibold">
				{data.meta.title}
			</h1>
			<div class="mt-1 flex flex-row text-2xl font-medium text-neutral-600 dark:text-neutral-400">
				<p>{data.meta.year}</p>
				<p class="mx-1">·</p>
				<Readotron selector=".readtime" lang="ar" />
			</div>
			<p class="text-2xl leading-tight font-medium text-neutral-500 dark:text-neutral-500">
				{data.meta.description}
			</p>
			<div
				class="tags mb-2 space-x-1.5 text-2xl font-medium text-neutral-400 dark:text-neutral-600"
			>
				<span class="-mr-1">Stack:</span>
				{#each data.meta.tags as tag}
					<span>{tag}</span>
				{/each}
			</div>
			<div class="my-4">
				<LikeButton />
			</div>
		</div>
		<div
			class="readtime prose-img:-pt-10 prose-em:-pt-20 prose prose-neutral dark:prose-invert prose-h1:text-3xl prose-h1:font-semibold prose-h1:tracking-tight prose-h2:font-semibold prose-h2:tracking-tight prose-a:no-underline prose-a:hover:underline prose-img:mx-auto prose-img:w-4/5 mt-10 max-w-none"
		>
			<svelte:component this={data.content} class="prose" />
		</div>
	</article>
</div>

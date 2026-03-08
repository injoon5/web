<script lang="ts">
	import { formatDate } from '$lib/utils';
	import LikeButton from '$lib/LikeButton.svelte';
	import Readotron from '@untemps/svelte-readotron';

	export let data;

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
			<h1 class="text-3xl font-semibold tracking-tight">
				{data.meta.title}
			</h1>
			<div class="mt-2 flex flex-row text-lg font-medium text-neutral-500 dark:text-neutral-400">
				<p>{data.meta.year}</p>
				<p class="mx-1">·</p>
				<Readotron selector=".readtime" lang="ar" />
			</div>
			<p class="mt-1 text-lg font-medium leading-snug text-neutral-500 dark:text-neutral-500">
				{data.meta.description}
			</p>
			<div
				class="tags mb-2 mt-1 space-x-1 text-base font-medium text-neutral-400 dark:text-neutral-600"
			>
				<span class="mr-0.5">Stack:</span>
				{#each data.meta.tags as tag}
					<span>{tag}</span>
				{/each}
			</div>
			<div class="my-4">
				<LikeButton />
			</div>
		</div>
		<div
			class="prose-p:text-neutral-900 dark:prose-p:text-neutral-100 readtime prose-img:-pt-10 prose-em:-pt-20 prose prose-neutral dark:prose-invert prose-h1:text-3xl prose-h1:font-semibold prose-h1:tracking-tight prose-h2:font-semibold prose-h2:tracking-tight prose-a:no-underline prose-a:hover:underline prose-img:mx-auto prose-img:w-4/5 mt-10 max-w-none"
		>
			<svelte:component this={data.content} class="prose" />
		</div>
	</article>
</div>

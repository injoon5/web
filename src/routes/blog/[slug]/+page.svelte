<script lang="ts">
	import { formatDate } from '$lib/utils';
	import SeriesList from '$lib/SeriesList.svelte';
	import CommentsSection from '$lib/comments/CommentsSection.svelte';
	import LikeButton from '$lib/LikeButton.svelte';

	import Readotron from '@untemps/svelte-readotron';

	export let data;

	$: ogImageUrl = `https://og.ij5.dev/api/og/?title=${encodeURIComponent(data.meta.title)}&subheading=${encodeURIComponent(formatDate(data.meta.date))}`;
</script>

<!-- SEO -->
<svelte:head>
	<title>{data.meta.title}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={data.meta.title} />
	<meta property="og:image" content={ogImageUrl} />
</svelte:head>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
	<article class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
		<!-- Title -->
		<div class="tracking-tight">
			{#if data.series?.[0]?.series}
				<h2 class="text-2xl font-medium text-neutral-500 dark:text-neutral-500">
					{data.series[0].series}
				</h2>
			{/if}
			<h1 class="text-3xl font-semibold tracking-tight md:font-semibold">
				{data.meta.title}
			</h1>
			<div class="mt-2 flex flex-row text-2xl font-medium text-neutral-600 dark:text-neutral-400">
				<p>{formatDate(data.meta.date)}</p>
				<p class="mx-1">·</p>
				<Readotron selector=".readtime" lang="ar" />
			</div>
			<div class="my-4">
				<LikeButton />
			</div>
			{#if data.series.length > 1 && data.meta.series != undefined}
				<div class="my-4">
					<SeriesList series={data.series} />
				</div>
			{/if}
		</div>

		<!-- Post -->
		<div
			class="readtime prose-img:-pt-10 prose-em:-pt-20 prose prose-neutral mt-10 max-w-none dark:prose-invert prose-a:no-underline hover:prose-a:underline prose-img:mx-auto prose-img:w-4/5"
		>
			<svelte:component this={data.content} class="prose" />
		</div>

		<div class="my-10">
			<CommentsSection />
		</div>
	</article>
</div>

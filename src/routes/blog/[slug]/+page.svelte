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
	<article class="col-span-1 lg:col-span-8 lg:col-start-3 pt-10 justify-center">
		<!-- Title -->
		<div class="tracking-tight">
			{#if data.series?.[0]?.series}
				<h2 class="text-lg text-neutral-600 font-medium dark:text-neutral-300">{data.series[0].series}</h2>
			{/if}
			<h1 class="text-3xl font-semibold tracking-tight md:text-3xl md:font-semibold">
				{data.meta.title}
			</h1>
			<div class="flex flex-row text-xl text-neutral-600 dark:text-neutral-300">
				<p>{formatDate(data.meta.date)}</p>
				<p class="mx-1">·</p>
				<Readotron selector=".readtime" lang="ar" />
			</div>
			<div class="my-2">
				<LikeButton />
			</div>
			<div class="my-2">
				{#if data.series.length > 1 && data.meta.series != undefined}
					<SeriesList series={data.series} />
				{/if}
			</div>
		</div>

		<!-- Post -->
		<div
			class="readtime prose-primary prose-em:text-primary-100 prose-img:-pt-10 prose-em:-pt-20 prose prose-invert mt-10 max-w-none md:prose-lg prose-a:no-underline hover:prose-a:underline prose-img:mx-auto prose-img:rounded"
		>
			<svelte:component this={data.content} class="prose" />
		</div>

		<div class="my-10">
			<CommentsSection />
		</div>
	</article>
</div>

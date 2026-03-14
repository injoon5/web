<script>
	import { formatDate } from '$lib/utils';
	import SeriesList from '$lib/SeriesList.svelte';
	import CommentsSection from '$lib/comments/CommentsSection.svelte';
	import LikeButton from '$lib/LikeButton.svelte';
	import Lightbox from '$lib/Lightbox.svelte';
	import { lightboxAction } from '$lib/lightbox.js';

	import Readotron from '@untemps/svelte-readotron';

	export let data;

	let lang = data.availableLangs[0] ?? 'en';

	$: currentMeta = (lang === 'ko' && data.koMeta) ? data.koMeta : (data.enMeta ?? data.meta);
	$: currentContent = (lang === 'ko' && data.koContent) ? data.koContent : data.enContent;
	$: ogImageUrl = `https://og.ij5.dev/api/og/?title=${encodeURIComponent(data.meta.title)}&subheading=${encodeURIComponent(formatDate(data.meta.date))}`;
</script>

<!-- SEO -->
<svelte:head>
	<title>{data.meta.title}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={data.meta.title} />
	<meta property="og:image" content={ogImageUrl} />
</svelte:head>

<Lightbox />

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
				{currentMeta.title}
			</h1>
			<div class="mt-2 flex flex-row text-2xl font-medium text-neutral-600 dark:text-neutral-400">
				<p>{formatDate(currentMeta.date)}</p>
				<p class="mx-1">·</p>
				<Readotron selector=".readtime" lang="ar" />
			</div>
			{#if data.availableLangs.length > 1}
				<div class="mt-2 flex items-center gap-1">
					{#each data.availableLangs as l}
						<button
							on:click={() => lang = l}
							class="rounded px-2 py-0.5 text-sm font-semibold transition-colors {lang === l
								? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
								: 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'}"
						>
							{l === 'en' ? 'EN' : '한국어'}
						</button>
					{/each}
				</div>
			{/if}
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
			use:lightboxAction
			class="readtime prose-img:-pt-10 prose-em:-pt-20 prose prose-neutral dark:prose-invert prose-p:text-neutral-900 dark:prose-p:text-neutral-100 prose-h1:font-semibold prose-h1:text-3xl prose-h1:tracking-tight prose-h2:font-semibold prose-h2:tracking-tight prose-a:no-underline prose-a:hover:underline prose-img:mx-auto prose-img:w-4/5 prose-img:cursor-zoom-in mt-10 max-w-none"
		>
			{#if currentContent}
				<svelte:component this={currentContent} class="prose" />
			{/if}
		</div>

		<div class="my-10">
			<CommentsSection />
		</div>
	</article>
</div>

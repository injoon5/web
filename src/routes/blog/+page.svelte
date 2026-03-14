<script>
	import PostLink from '$lib/PostLink.svelte';

	import { formatDate, sliceText } from '$lib/utils';
	import { lang } from '$lib/stores/lang.js';
	import { t } from '$lib/i18n/index.js';

	export let data;

	let renderedSeries = [];

	$: filteredPosts = data.posts.filter((p) => (p.lang ?? 'en') === $lang);
</script>

<svelte:head>
	<title>Blog - Injoon Oh</title>
</svelte:head>

<div class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
	<h1
		class="mt-20 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-100"
	>
		{$t.blog.title}
	</h1>
	<h2
		class="text-md text-xl font-semibold tracking-tight text-neutral-500 sm:text-2xl dark:text-neutral-500"
	>
		{$t.blog.subtitle}
	</h2>

	<div class="my-12 grid w-full grid-cols-1 divide-y divide-neutral-200 dark:divide-neutral-700">
		{#each filteredPosts as post}
			{#if post.series && !renderedSeries.includes(post.series) && renderedSeries.push(post.series)}
				<!-- Series group header -->
				<div
					class="py-2 text-base font-semibold text-neutral-600 sm:text-base dark:text-neutral-400"
				>
					Series: {post.series}
				</div>
				{#each filteredPosts.filter((p) => p.series === post.series) as seriesPost}
					<div class="py-2">
						<a
							href={`/blog/${seriesPost.slug}`}
							class="group ml-6 flex flex-row items-center justify-between gap-2"
						>
							<span
								class="line-clamp-1 text-base font-semibold text-neutral-900 group-hover:text-neutral-600 group-hover:underline sm:text-base dark:text-neutral-100 dark:group-hover:text-neutral-400"
							>
								{seriesPost.title}
							</span>
							<span
								class="ml-4 text-base font-semibold whitespace-nowrap text-neutral-500 group-hover:text-neutral-600 sm:text-base dark:text-neutral-400 dark:group-hover:text-neutral-500"
							>
								{seriesPost.date || seriesPost.year}
							</span>
						</a>
					</div>
				{/each}
			{:else if !post.series}
				<div class="py-2">
					<a
						href={`/blog/${post.slug}`}
						class="group flex flex-row items-center justify-between gap-2"
					>
						<span
							class="line-clamp-1 text-base font-semibold text-neutral-900 group-hover:text-neutral-600 group-hover:underline sm:text-base dark:text-neutral-100 dark:group-hover:text-neutral-400"
						>
							{post.title}
						</span>
						<span
							class="ml-4 text-base font-semibold whitespace-nowrap text-neutral-500 group-hover:text-neutral-600 sm:text-base dark:text-neutral-400 dark:group-hover:text-neutral-500"
						>
							{post.date || post.year}
						</span>
					</a>
				</div>
			{/if}
		{/each}
	</div>
</div>

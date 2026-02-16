<script lang="ts">
	import PostLink from '$lib/PostLink.svelte';

	import { onMount } from 'svelte';
	import { formatDate, sliceText } from '$lib/utils';

	export let data;

	let renderedSeries = [];

	export const prerender = true;
</script>

<svelte:head>
	<title>Blog - Injoon Oh</title>
</svelte:head>

<div class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
	<h1
		class="mt-20 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-100"
	>
		Blog
	</h1>
	<h2
		class="text-md text-xl font-semibold tracking-tight text-neutral-500 sm:text-2xl dark:text-neutral-500"
	>
		Stuff that just barely made it online. Take a look at what I've done, experienced, and wrote
		about.
	</h2>
	<!--
		<div class="my-6 text-base">
			{#each data.posts as post}
				{#if post.series && !renderedPosts.includes(post.series) && renderedPosts.push(post.series)}
					<p class="-mb-1 mt-4 font-semibold">Series: {post.series}</p>
					<div class="ml-5">
						{#each data.posts
							.filter((sameseries) => sameseries.series === post.series)
							.reverse() as same_series_post}
							<PostLink data={same_series_post} slug="blog" />
						{/each}
					</div>
				{:else if !post.series}
					<PostLink data={post} slug="blog" />
				{/if}
			{/each}
		</div>
		-->

	<div class="my-12 grid w-full grid-cols-1 divide-y divide-neutral-200 dark:divide-neutral-700">
		{#each data.posts as post}
			{#if post.series && !renderedSeries.includes(post.series) && renderedSeries.push(post.series)}
				<!-- Series group header -->
				<div
					class="py-2 text-base font-semibold text-neutral-600 sm:text-base dark:text-neutral-400"
				>
					Series: {post.series}
				</div>
				{#each data.posts.filter((p: any) => p.series === post.series) as seriesPost}
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

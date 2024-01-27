<script lang="ts">
	import { formatDate } from '$lib/utils';

	export let data;
</script>

<!-- SEO -->
<svelte:head>
	<title>{data.meta.title}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={data.meta.title} />
</svelte:head>

<article>
	<!-- Title -->
	<div>
		<h1 class="text-4xl font-semibold md:text-5xl md:font-semibold">{data.meta.title}</h1>
		<p class="text-xl font-medium md:text-2xl">Published at {formatDate(data.meta.date)}</p>
	</div>

	<!-- Tags -->
	<div class="tags my-1">
		{#each data.meta.categories as category}
			<span class="surface-4 rounded-lg p-1 transition hover:bg-[#424242]">&num;{category}</span>
		{/each}
	</div>
	<div class="border-t-1 flex-1 border-zinc-600 md:border-t-2"></div>

	<!-- Post -->
	<div class="prose md:prose-lg prose-invert prose-headings:no-underline mt-10">
		<svelte:component this={data.content} class="prose" />
	</div>
</article>

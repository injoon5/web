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

<article class="pt-10">
	<!-- Title -->
	<div>
		<h1 class="text-4xl font-semibold md:text-5xl md:font-semibold text-primary-50">
			{data.meta.title}
		</h1>
		<p class="text-xl font-medium md:text-2xl text-primary-300">Published at {formatDate(data.meta.date)}</p>
	</div>

	<!-- Tags -->
	<div class="tags my-1">
		{#each data.meta.categories as category}
			<span class="text-primary-100 surface-4 rounded-lg p-1 transition hover:bg-[#424242]">&num;{category}</span>
		{/each}
	</div>

	<!-- Post -->
	<div
		class="prose md:prose-lg prose-invert prose-img:mx-auto prose-primary prose-em:text-primary-100 prose-a:no-underline prose-img:rounded prose-img:-pt-10 prose-em:-pt-20 hover:prose-a:underline mt-10 max-w-none"
	>
		<svelte:component this={data.content} class="prose" />
	</div>
</article>

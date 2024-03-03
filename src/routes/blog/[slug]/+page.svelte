<script lang="ts">
	import { formatDate } from '$lib/utils';
	import Readotron from '@untemps/svelte-readotron';

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
	<div class="tracking-tight">
		<h1 class="text-primary-50 text-4xl font-semibold tracking-tight md:text-5xl md:font-semibold">
			{data.meta.title}
		</h1>
		<div class="flex flex-row">
			<p class="text-primary-300 text-xl font-medium md:text-2xl">
				Published at {formatDate(data.meta.date)}
			</p>
			<p class="text-primary-300 mx-2 text-xl font-medium md:text-2xl">·</p>
			<Readotron
				class="text-primary-300 text-xl font-medium md:text-2xl"
				selector=".readtime"
				lang="ko"
			/>
		</div>
		<div class="tags space-x-2">
			{#each data.meta.tags as tag}
				<span class="text-primary-100 font-medium md:text-xl">{tag}</span>
			{/each}
		</div>
	</div>

	<!-- Post -->
	<div
		class="readtime prose md:prose-lg prose-invert prose-img:mx-auto prose-primary prose-em:text-primary-100 prose-a:no-underline prose-img:rounded prose-img:-pt-10 prose-em:-pt-20 hover:prose-a:underline mt-10 max-w-none"
	>
		<svelte:component this={data.content} class="prose" />
	</div>
</article>

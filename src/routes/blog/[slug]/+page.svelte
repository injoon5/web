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
		<h1 class="text-primary-50 text-3xl md:text-3xl font-semibold tracking-tight md:font-semibold">
			{data.meta.title}
		</h1>
		<div class="flex flex-row text-primary-300 text-xl">
			<p>
				Published at {formatDate(data.meta.date)}
			</p>
			<p class="mx-2">·</p>
			<Readotron
				selector=".readtime"
				lang="ko"
			/>
		</div>
	</div>

	<!-- Post -->
	<div
		class="readtime prose dark:prose-invert prose-img:mx-auto prose-em:text-primary-100 prose-img:rounded prose-img:-pt-10 prose-em:-pt-20 hover:prose-a:underline mt-10 max-w-none"
	>
		<svelte:component this={data.content} class="prose" />
	</div>
</article>

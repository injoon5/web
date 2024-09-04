<script>
	import { page } from '$app/stores';
	export let series;
</script>

<div
	class="rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
>
	<h2 class="select-none px-3 pb-1 pt-3 text-xl font-semibold">Series: {series[0].series}</h2>
	{#each series.reverse() as post, index}
		<a
			href={post.slug === $page.params.slug ? '' : post.slug}
			class="{post.slug === $page.params.slug
				? 'cursor-default'
				: 'text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800'}  flex flex-row px-3 py-2 {index ===
			series.length - 1
				? 'rounded-b-lg'
				: ''}"
		>
			<div class="mr-2 mt-1 flex h-10 w-10 items-center justify-center rounded-full">
				<p class="text-xl font-semibold">{index + 1}</p>
			</div>
			<div class="block">
				<h2 class="text-primary-50 font-medum text-lg">{post.title}</h2>
				<p class="text-sm">{post.date}</p>
			</div>
		</a>
	{/each}
</div>

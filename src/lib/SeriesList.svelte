<script>
import { page } from "$app/stores";
export let series;
</script>

<div
	class="rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
>
	<h2
		class="line-clamp-1 select-none px-3 pb-2 pt-2 text-xl font-semibold text-neutral-900 dark:text-neutral-100"
	>
		Series: {series[0].series}
	</h2>
	{#each series.reverse() as post, index}
		<a
			href={post.slug === $page.params.slug ? '' : post.slug}
			class=" border-t border-neutral-200 dark:border-neutral-800 {post.slug === $page.params.slug
				? 'cursor-default opacity-50'
				: 'hover:bg-neutral-200  dark:hover:bg-neutral-800 '}  flex flex-row px-3 py-2 {index ===
			series.length - 1
				? 'rounded-b-md'
				: ''}"
		>
			<div class="mr-2 mt-1 flex h-10 w-10 items-center justify-center rounded-full">
				<p class="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{index + 1}</p>
			</div>
			<div class="block">
				<h2 class="-mb-1 line-clamp-1 text-lg font-semibold">{post.title}</h2>
				<p class="text-base font-medium text-neutral-500 dark:text-neutral-400">{post.date}</p>
			</div>
		</a>
	{/each}
</div>

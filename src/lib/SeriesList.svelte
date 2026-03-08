<script>
import { page } from "$app/stores";
export let series;
</script>

<div
	class="rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
>
	<p
		class="select-none px-3 pb-2 pt-2 text-sm font-semibold text-neutral-500 dark:text-neutral-400"
	>
		Series: {series[0].series}
	</p>
	{#each series.reverse() as post, index}
		<a
			href={post.slug === $page.params.slug ? '' : post.slug}
			class="border-t border-neutral-200 dark:border-neutral-800 {post.slug === $page.params.slug
				? 'cursor-default opacity-50'
				: 'hover:bg-neutral-200 dark:hover:bg-neutral-800'} flex flex-row items-center px-3 py-2.5 {index ===
			series.length - 1
				? 'rounded-b-xl'
				: ''}"
		>
			<div class="mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800">
				<p class="text-sm font-semibold text-neutral-600 dark:text-neutral-300">{index + 1}</p>
			</div>
			<div class="min-w-0">
				<p class="line-clamp-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">{post.title}</p>
				<p class="text-sm font-medium text-neutral-500 dark:text-neutral-400">{post.date}</p>
			</div>
		</a>
	{/each}
</div>

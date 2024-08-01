<script>
    export let series;
</script>

<div class="rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
    <h2 class="text-xl font-semibold px-3 pt-3 pb-1 select-none">Series: {series[0].series}</h2>
    {#each series.reverse() as post, index}
    <a href="{post.slug}" class="flex flex-row hover:bg-neutral-200 px-3 py-2 dark:hover:bg-neutral-800 {index === series.length - 1 ? 'rounded-b-lg' : ''}">
        <div
			class="flex h-10 w-10 items-center justify-center rounded-full mr-2 mt-1"
		>
			<p class="text-xl font-semibold">{index+1}</p>
		</div>
        <div class="block">
            <h2 class="text-primary-50 text-lg font-medum">{post.title}</h2>
            <p class="text-neutral-600 dark:text-neutral-300 text-sm">{post.date}</p>
        </div>
    </a>
    {/each}
</div>
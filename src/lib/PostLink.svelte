<script>
	export let data, slug;
</script>

<a
	class="flex items-center gap-1 pt-4 text-black hover:text-gray-600 hover:underline dark:text-white dark:hover:text-gray-200"
	href="/{slug}/{data.slug}"
>
	<h2 class="line-clamp-1 max-w-[75%] text-ellipsis">{data.title}</h2>
	<div class="line-clamp-1 h-px w-full flex-1 bg-gray-200 dark:bg-gray-700"></div>
	<div class="whitespace-nowrap">{data.date || data.year}</div>
</a>

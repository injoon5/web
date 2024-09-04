<script>
	export let linkto = '/';
</script>

<li>
	<a
		href={linkto}
		class="p-0 text-sm font-normal text-gray-500 hover:underline md:p-1 dark:text-gray-300"
		aria-current="page"><slot /></a
	>
</li>

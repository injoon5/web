<script>
	export let linkto = '/';
</script>

<li>
	<a
		href={linkto}
		class="block rounded px-3 py-2 text-white hover:text-gray-400 md:border-0 md:p-0 md:hover:bg-transparent"
		aria-current="page"><slot /></a
	>
</li>

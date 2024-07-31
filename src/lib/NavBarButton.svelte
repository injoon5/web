<script>
	export let linkto = '/';
</script>

<li>
		<a
			href={linkto}
			class="text-gray-500 dark:text-gray-300 p-0 text-sm font-normal underline md:p-1"
			aria-current="page"><slot /></a
		>
</li>

<script>
	import HoverLink from '$lib/HoverLink.svelte';
	export let linkto = '/';
</script>

<li>
	<HoverLink>
		<a
			href={linkto}
			class="text-primary-50 block rounded p-0 md:border-0 md:p-1 md:hover:bg-transparent"
			aria-current="page"><slot /></a
		>
	</HoverLink>
</li>

<script>
	import { onMount } from 'svelte';
	import '../app.css';
	import { page, navigating } from '$app/stores';
	// import NavBar from '$lib/NavBar.svelte';
	import NavBar2 from '$lib/NavBar2.svelte';
</script>

<nav class="bg-primary-900/30 sticky top-0 w-full pb-2 pt-4 backdrop-blur-sm">
	<NavBar2 />
</nav>

<div class="mx-auto max-w-4xl px-4 md:px-6">
	<slot />
</div>

<footer></footer>

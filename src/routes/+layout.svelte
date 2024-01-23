<script>
	import { onMount } from 'svelte';
	import '../app.css';
	import { page, navigating } from '$app/stores';
	import NavBar from '$lib/NavBar.svelte';
</script>

<nav >
	<NavBar />
	
</nav>

<div class="mx-auto">
	<slot />
</div>

<footer>
</footer>

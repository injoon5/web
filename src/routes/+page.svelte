<script>
	import WhiteText from '$lib/WhiteText.svelte';
	import { onMount } from 'svelte';
</script>

<svelte:head>
	<title>Injoon Oh</title>
</svelte:head>

<h1 class="text-3xl font-bold text-gray-400 md:text-4xl">
	<WhiteText>Injoon Oh</WhiteText> is a <WhiteText>student</WhiteText> in <WhiteText
		>Korea.
	</WhiteText>He is interested in
	<WhiteText>computers, math and science.</WhiteText> When he takes a rest, he likes to <WhiteText
		>read books</WhiteText
	>
	and <WhiteText>play with friends.</WhiteText>
</h1>

<div class="grid grid-cols-1 gap-4 py-10 md:grid-cols-2">
	<div>
		<h2 class="text-2xl font-semibold md:text-3xl">Blog</h2>
		<div class="my-2 p-2 hover:bg-gray-700 rounded-lg transition">
			<span class="flex flex-wrap">
				<h3 class="text-xl font-semibold md:text-2xl">How to Hack the NSA</h3>
				<p class="px-2 text-xl font-medium text-gray-400 md:text-2xl">—</p>
				<p class="text-xl font-medium text-gray-400 md:text-2xl">Jan 26</p>
			</span>
			<p class="text-md md:text-lg font-normal">Lorem Ipsum Dolor Si Amet.</p>
		</div>
	</div>
	<div>
		<h2 class="text-2xl font-semibold md:text-3xl">Projects</h2>
		<div class="my-2 p-2 hover:bg-gray-700 rounded-lg transition">
			<span class="flex flex-wrap">
				<h3 class="text-xl font-semibold md:text-2xl">Hydrogen Bomb</h3>
				<p class="px-2 text-xl font-medium text-gray-400 md:text-2xl">—</p>
				<p class="text-xl font-medium text-gray-400 md:text-2xl">Jan 26</p>
			</span>
			<p class="text-md md:text-lg font-normal">Lorem Ipsum Dolor Si Amet.</p>
		</div>
	</div>
</div>

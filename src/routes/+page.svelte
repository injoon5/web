<script lang="ts">
	import WhiteText from '$lib/WhiteText.svelte';
	import { onMount } from 'svelte';
	import { formatDate, sliceDescription } from '$lib/utils';

	export let data;
</script>

<svelte:head>
	<title>Injoon Oh</title>
</svelte:head>

<h1 class="text-3xl font-semibold tracking-tighter text-[#C6C6C6] md:text-4xl">
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
		{#each data.posts.slice(0, 4) as post}
			<div class="my-2 rounded-lg p-2 transition hover:bg-[#424242]">
				<span class="flex flex-wrap">
					<a href="/blog/{post.slug}" class="text-xl font-semibold md:text-2xl">{post.title}</a>
					<p class="px-2 text-xl font-medium text-gray-400 md:text-2xl">—</p>
					<p class="text-xl font-medium text-gray-400 md:text-2xl">{formatDate(post.date)}</p>
				</span>
				<p class="text-md font-normal md:text-lg">
					{sliceDescription(post.description)}
				</p>
			</div>
		{/each}
	</div>
	<div>
		<h2 class="text-2xl font-semibold md:text-3xl">Projects</h2>
		<div class="my-2 rounded-lg p-2 transition hover:bg-gray-700">
			<span class="flex flex-wrap">
				<h3 class="text-xl font-semibold md:text-2xl">Hydrogen Bomb</h3>
				<p class="px-2 text-xl font-medium text-gray-400 md:text-2xl">—</p>
				<p class="text-xl font-medium text-gray-400 md:text-2xl">Jan 26</p>
			</span>
			<p class="text-md font-normal md:text-lg">Lorem Ipsum Dolor Si Amet.</p>
		</div>
	</div>
</div>

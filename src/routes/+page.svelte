<script lang="ts">
	import WhiteText from '$lib/WhiteText.svelte';
	import HoverLink from '$lib/HoverLink.svelte';
	import Balancer from '$lib/Balancer.svelte';
	import { onMount } from 'svelte';
	import { formatDate, sliceText } from '$lib/utils';

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
		<h2 class=" text-xl font-bold md:text-2xl">Blog</h2>
		{#each data.posts.slice(0, 4) as post}
			<div class="my-2">
				<HoverLink>
					<a href="/blog/{post.slug}" class="text-lg font-semibold md:text-xl">{post.title}</a>
				</HoverLink>

				<span class="text-md font-normal md:text-lg">
					<p>{sliceText(post.description, 10)}</p>
					<time datetime class="text-gray-400">{formatDate(post.date)}</time>
				</span>
			</div>
		{/each}
	</div>
	<div>
		<h2 class="text-xl font-bold md:text-2xl">Blog</h2>
		<div class="my-2">
			<HoverLink>
				<a href="/projects}" class="text-lg font-semibold md:text-xl">Something...</a>
			</HoverLink>

			<span class="text-md font-normal md:text-lg">
				<p>Example Text</p>
				<time datetime class="text-gray-400">Example</time>
			</span>
		</div>
	</div>
</div>

<script>
	import { page } from '$app/stores';
	import { blur } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	export let series;

	let reduceMotion = false;
	let mounted = false;
	onMount(() => {
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		requestAnimationFrame(() => requestAnimationFrame(() => (mounted = true)));
	});
	$: bf = { amount: 8, opacity: 0, duration: mounted && !reduceMotion ? 420 : 0, easing: cubicOut };
	// Empty config when duration is 0 so no opacity-0 start frame blinks on load.
	const blurT = (node, params) => (params.duration ? blur(node, params) : {});
	// Reverse a copy — mutating the prop in place flipped the order on every render.
	$: ordered = [...series].reverse();
</script>

<div
	class="rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
>
	<div class="grid px-3 pt-2 pb-2">
		{#key series[0].series}
			<h2
				style="grid-area: 1 / 1;"
				in:blurT={bf}
				out:blurT={bf}
				class="line-clamp-1 text-lg font-semibold text-neutral-900 select-none dark:text-neutral-100"
			>
				Series: {series[0].series}
			</h2>
		{/key}
	</div>
	{#each ordered as post, index (post.slug)}
		<svelte:element
			this={post.slug === $page.params.slug ? 'span' : 'a'}
			href={post.slug === $page.params.slug ? undefined : post.slug}
			aria-current={post.slug === $page.params.slug ? 'page' : undefined}
			class=" border-t border-neutral-200 dark:border-neutral-800 {post.slug === $page.params.slug
				? 'cursor-default opacity-50'
				: 'hover:bg-neutral-200  dark:hover:bg-neutral-800 '}  flex flex-row px-3 py-2 {index ===
			ordered.length - 1
				? 'rounded-b-xl'
				: ''}"
		>
			<div class="mt-1 mr-2 flex h-10 w-10 items-center justify-center rounded-full">
				<p class="text-xl font-medium text-neutral-900 tabular-nums dark:text-neutral-100">
					{index + 1}
				</p>
			</div>
			<div class="block">
				<div class="grid">
					{#key post.title}
						<h2
							style="grid-area: 1 / 1;"
							in:blurT={bf}
							out:blurT={bf}
							class="-mb-1 line-clamp-1 text-lg font-medium"
						>
							{post.title}
						</h2>
					{/key}
				</div>
				<p class="text-sm font-normal text-neutral-500 dark:text-neutral-400">{post.date}</p>
			</div>
		</svelte:element>
	{/each}
</div>

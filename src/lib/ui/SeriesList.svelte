<script>
	import { motion } from '$lib/reduced-motion.svelte.js';
	import { page } from '$app/state';
	import { blur } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	let { series } = $props();

	let mounted = $state(false);
	onMount(() => {
		requestAnimationFrame(() => requestAnimationFrame(() => (mounted = true)));
	});
	const bf = $derived({
		amount: 8,
		opacity: 0,
		duration: mounted && !motion.reduced ? 420 : 0,
		easing: cubicOut
	});
	// Empty config when duration is 0 so no opacity-0 start frame blinks on load.
	const blurT = (node, params) => (params.duration ? blur(node, params) : {});
	// Reverse a copy — mutating the prop in place flipped the order on every render.
	const ordered = $derived([...series].reverse());
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
		{@const current = post.slug === page.params.slug}
		<!-- An `<a>` without `href` is not a link: it is neither focusable nor
		     announced as one, and it cannot navigate. The current post is the
		     active row, not a destination. -->
		<a
			href={current ? undefined : post.slug}
			aria-current={current ? 'page' : undefined}
			class=" border-t border-neutral-200 dark:border-neutral-800 {current
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
		</a>
	{/each}
</div>

<script>
import { page } from "$app/stores";
import { blur } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { onMount, tick } from 'svelte';
export let series;

let reduceMotion = false;
let mounted = false;
onMount(async () => {
	reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	await tick();
	mounted = true;
});
$: bf = { amount: 8, opacity: 0, duration: mounted && !reduceMotion ? 420 : 0, easing: cubicOut };
</script>

<div
	class="rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
>
	<div class="grid px-3 pb-2 pt-2">
		{#key series[0].series}
			<h2
				style="grid-area: 1 / 1;"
				in:blur={bf}
				out:blur={bf}
				class="line-clamp-1 select-none text-lg font-semibold text-neutral-900 dark:text-neutral-100"
			>
				Series: {series[0].series}
			</h2>
		{/key}
	</div>
	{#each series.reverse() as post, index}
		<a
			href={post.slug === $page.params.slug ? '' : post.slug}
			class=" border-t border-neutral-200 dark:border-neutral-800 {post.slug === $page.params.slug
				? 'cursor-default opacity-50'
				: 'hover:bg-neutral-200  dark:hover:bg-neutral-800 '}  flex flex-row px-3 py-2 {index ===
			series.length - 1
				? 'rounded-b-xl'
				: ''}"
		>
			<div class="mr-2 mt-1 flex h-10 w-10 items-center justify-center rounded-full">
				<p class="text-xl font-medium text-neutral-900 dark:text-neutral-100 tabular-nums">{index + 1}</p>
			</div>
			<div class="block">
				<div class="grid">
					{#key post.title}
						<h2 style="grid-area: 1 / 1;" in:blur={bf} out:blur={bf} class="-mb-1 line-clamp-1 text-lg font-medium">{post.title}</h2>
					{/key}
				</div>
				<p class="text-sm font-normal text-neutral-500 dark:text-neutral-400">{post.date}</p>
			</div>
		</a>
	{/each}
</div>

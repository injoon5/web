<script lang="ts">
	import WhiteText from '$lib/WhiteText.svelte';
	import HoverLink from '$lib/HoverLink.svelte';
	import Balancer from '$lib/Balancer.svelte';
	import { onMount } from 'svelte';
	import { formatDate, sliceText } from '$lib/utils';

	export let data;
</script>

<svelte:head>
	<title>Projects - Injoon Oh</title>
</svelte:head>

<h1 class="text-primary-50 mt-16 text-3xl font-semibold tracking-tighter md:text-4xl">Projects</h1>

<div class="text-primary-50 mt-10 grid w-full grid-cols-1 text-xl">
	{#each data.projects.slice(0, 4) as project}
		<div
			class="border-t-primary-600 flex items-center justify-between justify-items-stretch border-t py-3 md:border-t-2"
		>
			<div class="flex flex-row justify-self-start">
				<HoverLink>
					<a
						href="/projects/{project.slug}"
						class="text-primary-50 flex flex-auto text-base font-medium md:text-lg"
						>{sliceText(project.title, 10)}</a
					>
				</HoverLink>
				<div class="hidden md:mx-2 md:flex md:flex-row">
					{#each project.language as language}
						<p
							class="font-rubik bg-primary-950 text-primary-50 mx-1 rounded px-2 pt-0.5 text-base font-light"
						>
							{language}
						</p>
					{/each}
				</div>
			</div>
			<time class="text-primary-400 justify-self-end text-base font-normal md:text-lg"
				>{project.year}</time
			>
		</div>
	{/each}
</div>

<script lang="ts">
	import HoverLink from '$lib/HoverLink.svelte';

	import { onMount } from 'svelte';
	import { formatDate, sliceText } from '$lib/utils';

	export let data;
</script>

<svelte:head>
	<title>Projects - Injoon Oh</title>
</svelte:head>

<h1 class="mt-16 text-3xl font-semibold tracking-tighter text-primary-50 md:text-4xl">Projects</h1>

<div class="mt-10 grid w-full grid-cols-1 text-xl text-primary-50">
	{#each data.projects.slice(0, 4) as project}
		<div
			class="flex items-center justify-between justify-items-stretch border-t border-t-primary-600 py-3 md:border-t-2"
		>
			<div class="flex flex-row justify-self-start">
				<HoverLink>
					<a
						href="/projects/{project.slug}"
						class="flex flex-auto text-base font-medium text-primary-50 md:text-lg"
						>{sliceText(project.title, 10)}</a
					>
				</HoverLink>
				<div class="hidden md:mx-2 md:flex md:flex-row">
					{#each project.tags as tags}
						<p
							class="mx-1 rounded bg-primary-950 px-2 pt-0.5 font-rubik text-base font-light text-primary-50"
						>
							{tags}
						</p>
					{/each}
				</div>
			</div>
			<time class="justify-self-end text-base font-normal text-primary-400 md:text-lg"
				>{project.year}</time
			>
		</div>
	{/each}
</div>

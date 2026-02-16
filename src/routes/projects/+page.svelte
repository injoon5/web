<script lang="ts">
	export let data;
</script>

<svelte:head>
	<title>Projects - Injoon Oh</title>
</svelte:head>

<div class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
	<h1
		class="mt-20 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-100"
	>
		Projects
	</h1>
	<h2
		class="text-md text-xl font-semibold tracking-tight text-neutral-500 sm:text-2xl dark:text-neutral-500"
	>
		Some of the stuff I did to escape from a boring day. Everything from school projects to personal
		projects. (Not updated yet)
	</h2>

	<div class="my-12 grid w-full grid-cols-1 divide-y divide-neutral-200 dark:divide-neutral-700">
		{#each data.projects as project}
			<div class="py-2">
				<a
					href={`/projects/${project.slug}`}
					class="group flex flex-row items-center justify-between gap-2"
				>
					<span
						class="line-clamp-1 text-base font-semibold text-neutral-900 group-hover:text-neutral-600 group-hover:underline sm:text-base dark:text-neutral-100 dark:group-hover:text-neutral-400"
					>
						{project.title}
					</span>
					<span
						class="ml-4 text-base font-semibold whitespace-nowrap text-neutral-500 group-hover:text-neutral-600 sm:text-base dark:text-neutral-400 dark:group-hover:text-neutral-500"
					>
						{project.date || project.year}
					</span>
				</a>
			</div>
		{/each}
	</div>
</div>

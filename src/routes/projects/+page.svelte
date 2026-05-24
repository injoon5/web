<script>
	export let data;
</script>

<svelte:head>
	<title>Projects - Injoon Oh</title>
	<meta
		name="description"
		content="Some of the stuff I did to escape from a boring day. Everything from school projects to personal projects."
	/>
	<meta property="og:title" content="Projects - Injoon Oh" />
	<meta
		property="og:description"
		content="Some of the stuff I did to escape from a boring day. Everything from school projects to personal projects."
	/>
	<meta property="og:image" content="https://www.injoon5.com/api/og?template=projects" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="https://www.injoon5.com/api/og?template=projects" />
	<meta property="og:url" content="https://www.injoon5.com/projects" />
</svelte:head>

<div class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
	<h1
		class="mt-20 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-2xl dark:text-neutral-100"
	>
		Projects
	</h1>
	<h2
		class="text-md text-xl font-medium tracking-tight text-neutral-500 sm:text-xl dark:text-neutral-500"
	>
		Some of the stuff I did to escape from a boring day. <br />Everything from school projects to
		personal projects. (WIP)
	</h2>

	<div class="my-12 grid w-full grid-cols-1 divide-y divide-neutral-200 dark:divide-neutral-700">
		{#each data.projects as project}
			<div class="py-4">
				<a href={`/projects/${project.slug}`} class="group block">
					<div class="flex flex-row items-start justify-between gap-4">
						<h3
							class="line-clamp-1 text-base font-medium text-neutral-900 group-hover:text-neutral-600 group-hover:underline dark:text-neutral-100 dark:group-hover:text-neutral-400"
						>
							{project.title}
						</h3>
						<span
							class="tabular shrink-0 text-base font-medium whitespace-nowrap text-neutral-500 group-hover:text-neutral-600 dark:text-neutral-400 dark:group-hover:text-neutral-500"
						>
							{project.date || project.year}
						</span>
					</div>
					{#if project.description}
						<p
							class="mt-1 line-clamp-2 text-sm leading-relaxed font-medium text-neutral-600 dark:text-neutral-400"
						>
							{project.description}
						</p>
					{/if}
					{#if project.tags?.length}
						<div class="mt-2 flex flex-wrap items-center gap-1.5">
							{#each project.tags as tag}
								<span
									class="inline-flex items-center rounded-full border border-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:text-neutral-400"
								>
									{tag}
								</span>
							{/each}
						</div>
					{/if}
				</a>
			</div>
		{/each}
	</div>
</div>

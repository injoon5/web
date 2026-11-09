<script>
	import { SITE_URL } from '#lib/content/article-paths.js';
	import { ogImageUrl } from '#lib/og/url.js';
	import FontPrefetch from '#lib/fonts/FontPrefetch.svelte';
	import { preloadArticles } from '#lib/content/preload-articles.js';

	let { data } = $props();
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
	<meta name="author" content="Injoon Oh (오인준)" />
	<meta name="keywords" content="오인준, Injoon Oh, projects, 프로젝트, 개발, portfolio" />
	<meta property="og:image" content={ogImageUrl('projects')} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={ogImageUrl('projects')} />
	<meta property="og:url" content="{SITE_URL}/projects" />
</svelte:head>

<FontPrefetch />

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

	<!-- As its links come into view, an article's route code and its content are
	     fetched, so a click renders the post without waiting on the network. -->
	<div
		class="my-12 grid w-full grid-cols-1 divide-y divide-neutral-200 dark:divide-neutral-700"
		data-sveltekit-preload-code="viewport"
		use:preloadArticles
	>
		{#each data.projects as project (project.slug)}
			<div class="py-2">
				<a
					href={`/projects/${project.slug}`}
					class="group flex flex-row items-center justify-between gap-2"
				>
					<span class="flex min-w-0 items-center gap-2">
						<span
							lang={project.lang}
							class="line-clamp-1 text-base font-medium text-neutral-900 group-hover:text-neutral-600 group-hover:underline sm:text-base dark:text-neutral-100 dark:group-hover:text-neutral-400"
						>
							{project.title}
						</span>
						{#if project.hasEn}
							<span
								class="shrink-0 text-xs font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-600"
							>
								EN
							</span>
						{/if}
					</span>
					<span
						class="ml-4 text-base font-medium whitespace-nowrap text-neutral-500 group-hover:text-neutral-600 sm:text-base dark:text-neutral-400 dark:group-hover:text-neutral-500"
					>
						{project.date || project.year}
					</span>
				</a>
			</div>
		{/each}
	</div>
</div>

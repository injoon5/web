<script>
	let { data } = $props();

	const groupedPosts = $derived.by(() => {
		// Scratch set, created and discarded inside this derivation.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const seenSeries = new Set();
		const result = [];
		for (const post of data.posts) {
			if (post.series) {
				if (seenSeries.has(post.series)) continue;
				seenSeries.add(post.series);
				result.push({
					type: 'series',
					key: `series:${post.series}`,
					name: post.series,
					posts: data.posts.filter((p) => p.series === post.series)
				});
			} else {
				result.push({ type: 'post', key: `post:${post.slug}`, post });
			}
		}
		return result;
	});
</script>

<svelte:head>
	<title>Blog - Injoon Oh</title>
	<meta
		name="description"
		content="Stuff that just barely made it online. Take a look at what I've done, experienced, and wrote about."
	/>
	<meta property="og:title" content="Blog - Injoon Oh" />
	<meta
		property="og:description"
		content="Stuff that just barely made it online. Take a look at what I've done, experienced, and wrote about."
	/>
	<meta name="author" content="Injoon Oh (오인준)" />
	<meta name="keywords" content="오인준, Injoon Oh, 블로그, blog, 글, writing" />
	<meta property="og:image" content="https://www.injoon5.com/api/og?template=blog" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="https://www.injoon5.com/api/og?template=blog" />
	<meta property="og:url" content="https://www.injoon5.com/blog" />
</svelte:head>

<div class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
	<h1
		class="mt-20 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-2xl dark:text-neutral-100"
	>
		Blog
	</h1>
	<h2
		class="text-md text-xl font-medium tracking-tight text-neutral-500 sm:text-xl dark:text-neutral-500"
	>
		Stuff that just barely made it online. <br />Take a look at what I've done, experienced, and
		wrote about.
	</h2>
	<div class="my-12 grid w-full grid-cols-1 divide-y divide-neutral-200 dark:divide-neutral-700">
		{#each groupedPosts as group (group.key)}
			{#if group.type === 'series'}
				<div class="py-2">
					<span
						class="line-clamp-1 text-base font-medium tracking-wide text-neutral-500 dark:text-neutral-500"
					>
						{group.name}
					</span>
				</div>
				{#each group.posts as seriesPost (seriesPost.slug)}
					<div class="py-2">
						<a
							href={`/blog/${seriesPost.slug}`}
							class="group ml-6 flex flex-row items-center justify-between gap-2"
						>
							<span class="flex min-w-0 items-center gap-2">
								<span
									class="line-clamp-1 text-base font-medium text-neutral-900 group-hover:text-neutral-600 group-hover:underline dark:text-neutral-100 dark:group-hover:text-neutral-400"
								>
									{seriesPost.title}
								</span>
								{#if seriesPost.hasEn}
									<span
										class="shrink-0 text-xs font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-600"
									>
										EN
									</span>
								{/if}
							</span>
							<span
								class="tabular ml-4 shrink-0 text-base font-medium whitespace-nowrap text-neutral-500 group-hover:text-neutral-600 dark:text-neutral-400 dark:group-hover:text-neutral-500"
							>
								{seriesPost.date || seriesPost.year}
							</span>
						</a>
					</div>
				{/each}
			{:else}
				<div class="py-2">
					<a
						href={`/blog/${group.post.slug}`}
						class="group flex flex-row items-center justify-between gap-2"
					>
						<span class="flex min-w-0 items-center gap-2">
							<span
								class="line-clamp-1 text-base font-medium text-neutral-900 group-hover:text-neutral-600 group-hover:underline dark:text-neutral-100 dark:group-hover:text-neutral-400"
							>
								{group.post.title}
							</span>
							{#if group.post.hasEn}
								<span
									class="shrink-0 text-xs font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-600"
								>
									EN
								</span>
							{/if}
						</span>
						<span
							class="tabular ml-4 shrink-0 text-base font-medium whitespace-nowrap text-neutral-500 group-hover:text-neutral-600 dark:text-neutral-400 dark:group-hover:text-neutral-500"
						>
							{group.post.date || group.post.year}
						</span>
					</a>
				</div>
			{/if}
		{/each}
	</div>
</div>

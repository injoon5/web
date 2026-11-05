<script>
	import Article from '#lib/article/Article.svelte';
	import SwapLine from '#lib/article/SwapLine.svelte';
	import { SITE_URL } from '#lib/content/article-paths.js';
	import { projectSchema, breadcrumbSchema, keywordsFor, jsonLdScript } from '#lib/seo/jsonld.js';

	let { data } = $props();

	/** @param {Record<string, any>} meta */
	const ogImage = (meta) =>
		`${SITE_URL}/api/og?template=project&title=${encodeURIComponent(meta.title)}&description=${encodeURIComponent(meta.description || '')}&year=${encodeURIComponent(meta.year || '')}&tags=${encodeURIComponent((meta.tags || []).join(','))}`;

	// The project's hand-picked keywords lead among the page terms — the phrases
	// it targets — then its title and tags, the same order the blog page uses.
	/** @param {Record<string, any>} meta */
	const keywordsOf = (meta) =>
		keywordsFor([...(meta.keywords ?? []), meta.title, ...(meta.tags ?? [])]);
</script>

{#snippet head(meta, url)}
	<meta name="keywords" content={keywordsOf(meta).join(', ')} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- generated JSON-LD -->
	{@html jsonLdScript(
		projectSchema({
			title: meta.title,
			description: meta.description ?? '',
			year: meta.year ?? '',
			url,
			image: ogImage(meta),
			lang: data.lang,
			keywords: keywordsOf(meta)
		})
	)}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- generated JSON-LD -->
	{@html jsonLdScript(
		breadcrumbSchema([
			{ name: 'Injoon Oh', url: `${SITE_URL}/` },
			{ name: 'Projects', url: `${SITE_URL}/projects` },
			{ name: meta.title, url }
		])
	)}
{/snippet}

{#snippet dateline(meta)}
	<p class="tabular">{meta.year}</p>
{/snippet}

{#snippet intro(view)}
	<SwapLine
		displayLang={view.displayLang}
		text={(l) => view.entryFor(l).meta.description}
		transition={view.titleBlur}
		height={view.headerHeight}
		outerClass="mt-3"
		class="text-2xl leading-tight font-medium text-neutral-500 dark:text-neutral-500"
	/>
	<div class="mt-3 flex flex-wrap items-center gap-2">
		{#each view.entryFor(view.displayLang).meta.tags ?? [] as tag (tag)}
			<span
				class="inline-flex items-center rounded-full border border-neutral-200 px-2.5 py-1 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"
			>
				{tag}
			</span>
		{/each}
	</div>
{/snippet}

{#key data.slug}
	<Article {data} {ogImage} {head} {dateline} {intro} bylineClass="text-2xl" />
{/key}

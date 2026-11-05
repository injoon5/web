<script>
	import Article from '#lib/article/Article.svelte';
	import SwapLine from '#lib/article/SwapLine.svelte';
	import { formatDate } from '#lib/format.js';
	import SeriesList from '#lib/ui/SeriesList.svelte';
	import LazyComments from '#lib/comments/LazyComments.svelte';
	import { SITE_URL } from '#lib/content/article-paths.js';
	import {
		blogPostingSchema,
		breadcrumbSchema,
		keywordsFor,
		jsonLdScript
	} from '#lib/seo/jsonld.js';

	let { data } = $props();

	/** @param {Record<string, any>} meta */
	const ogImage = (meta) =>
		`${SITE_URL}/api/og?template=blog-post&title=${encodeURIComponent(meta.title)}&description=${encodeURIComponent(meta.description || '')}&date=${encodeURIComponent(meta.date || '')}`;

	// Author names lead (so 오인준 rides on every article), then the post's own
	// hand-picked keywords, its title, series and tags. The frontmatter keywords
	// come first among the page terms — they are the phrases the post targets.
	/** @param {Record<string, any>} meta */
	const keywordsOf = (meta) =>
		keywordsFor([...(meta.keywords ?? []), meta.title, meta.series, ...(meta.tags ?? [])]);
</script>

{#snippet head(meta, url)}
	<meta name="keywords" content={keywordsOf(meta).join(', ')} />
	<meta property="article:published_time" content={meta.date ?? ''} />
	<meta property="article:author" content="Injoon Oh (오인준)" />
	{#if meta.series}
		<meta property="article:section" content={meta.series} />
	{/if}
	{#each meta.tags ?? [] as tag (tag)}
		<meta property="article:tag" content={tag} />
	{/each}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- generated JSON-LD -->
	{@html jsonLdScript(
		blogPostingSchema({
			title: meta.title,
			description: meta.description ?? '',
			date: meta.date ?? '',
			url,
			image: ogImage(meta),
			lang: data.lang,
			keywords: keywordsOf(meta),
			section: meta.series
		})
	)}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- generated JSON-LD -->
	{@html jsonLdScript(
		breadcrumbSchema([
			{ name: 'Injoon Oh', url: `${SITE_URL}/` },
			{ name: 'Blog', url: `${SITE_URL}/blog` },
			{ name: meta.title, url }
		])
	)}
{/snippet}

{#snippet eyebrow(view)}
	{#if view.entryFor(view.displayLang).series[0]?.series}
		<SwapLine
			tag="h2"
			displayLang={view.displayLang}
			text={(l) => view.entryFor(l).series[0]?.series}
			transition={view.titleBlur}
			height={view.headerHeight}
			class="text-xl font-medium text-neutral-500 dark:text-neutral-500"
		/>
	{/if}
{/snippet}

{#snippet dateline(meta)}
	<p class="tabular whitespace-nowrap">{formatDate(meta.date)}</p>
{/snippet}

{#snippet aside(view)}
	{@const current = view.entryFor(view.displayLang)}
	{#if current.series.length > 1 && current.meta.series != undefined}
		<div class="my-4">
			<SeriesList series={current.series} lang={view.displayLang} />
		</div>
	{/if}
{/snippet}

{#snippet footer()}
	<div class="my-10">
		<LazyComments />
	</div>
{/snippet}

{#key data.slug}
	<Article {data} {ogImage} {head} {eyebrow} {dateline} {aside} {footer} />
{/key}

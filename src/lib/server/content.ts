export const CONTENT_CACHE_CONTROL =
	'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

type MarkdownModule = { metadata?: Record<string, unknown> };

/**
 * Resolve published content items from en/ko glob results.
 * Korean takes precedence when both languages exist for the same slug.
 */
export function resolvePublished(
	enPaths: Record<string, unknown>,
	koPaths: Record<string, unknown>
): Record<string, unknown>[] {
	// Only published English versions count toward the EN badge — the detail
	// page hides unpublished translations, so an unpublished en/ file must not
	// advertise an English version that isn't actually available.
	const enSlugs = new Set<string>();
	for (const path in enPaths) {
		const file = enPaths[path] as MarkdownModule;
		const slug = path.split('/').at(-1)?.replace('.md', '');
		if (slug && file?.metadata?.published) enSlugs.add(slug);
	}

	const bySlug: Record<string, Record<string, unknown>> = {};
	for (const paths of [enPaths, koPaths]) {
		for (const path in paths) {
			const file = paths[path] as MarkdownModule;
			const slug = path.split('/').at(-1)?.replace('.md', '');
			if (file?.metadata && slug) {
				const item = { ...file.metadata, slug, hasEn: enSlugs.has(slug) };
				if (item.published) bySlug[slug] = item;
			}
		}
	}

	return Object.values(bySlug);
}

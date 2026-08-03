import type { Post, Project } from '$lib/types';
import { blogEnMeta, blogKoMeta, projectEnMeta, projectKoMeta } from './content-modules.js';

export const CONTENT_CACHE_CONTROL =
	'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

type Metadata = Record<string, unknown>;

/**
 * Resolve published content items from en/ko metadata glob results.
 * Korean takes precedence when both languages exist for the same slug.
 *
 * The glob values are metadata records, not modules — see content-modules.js.
 */
export function resolvePublished(
	enPaths: Record<string, unknown>,
	koPaths: Record<string, unknown>
): Metadata[] {
	const enSlugs = new Set<string>();
	for (const path in enPaths) {
		const slug = path.split('/').at(-1)?.replace('.md', '');
		if (slug) enSlugs.add(slug);
	}

	const bySlug: Record<string, Metadata> = {};
	for (const paths of [enPaths, koPaths]) {
		for (const path in paths) {
			const metadata = paths[path] as Metadata | undefined;
			const slug = path.split('/').at(-1)?.replace('.md', '');
			if (metadata && slug) {
				const item: Metadata = { ...metadata, slug, hasEn: enSlugs.has(slug) };
				if (item.published) bySlug[slug] = item;
			}
		}
	}

	return Object.values(bySlug);
}

const byDateDesc = (a: string | undefined, b: string | undefined) =>
	new Date(b ?? '').getTime() - new Date(a ?? '').getTime();

/**
 * The published post list, newest first.
 *
 * One definition, shared by the page loads and by `/api/posts`. The loads used
 * to reach the list by `fetch`ing that endpoint, which meant the same records
 * were resolved twice and written into the build twice — once as the static
 * endpoint and once into each page's data payload — and re-fetched over the
 * network on every client-side navigation to a listing page.
 */
export function publishedPosts(): Post[] {
	return (resolvePublished(blogEnMeta, blogKoMeta) as Post[]).sort((a, b) =>
		byDateDesc(a.date, b.date)
	);
}

/** The published project list, newest first. */
export function publishedProjects(): Project[] {
	return (resolvePublished(projectEnMeta, projectKoMeta) as Project[]).sort((a, b) =>
		byDateDesc(a.year, b.year)
	);
}

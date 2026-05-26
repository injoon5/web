export const prerender = true;

import { json } from '@sveltejs/kit';
import type { Project } from '$lib/types';

async function getProjects() {
	const enPaths = import.meta.glob('/src/routes/projects/projects/en/*.md', { eager: true });
	const koPaths = import.meta.glob('/src/routes/projects/projects/ko/*.md', { eager: true });

	const enSlugs = new Set<string>();
	for (const path in enPaths) {
		const slug = path.split('/').at(-1)?.replace('.md', '');
		if (slug) enSlugs.add(slug);
	}

	const bySlug: Record<string, Project> = {};

	// English first, Korean second, so Korean wins when both exist (site default).
	for (const [paths] of [[enPaths], [koPaths]] as const) {
		for (const path in paths) {
			const file = paths[path];
			const slug = path.split('/').at(-1)?.replace('.md', '');
			if (file && typeof file === 'object' && 'metadata' in file && slug) {
				const metadata = file.metadata as Omit<Project, 'slug'>;
				const project = { ...metadata, slug, hasEn: enSlugs.has(slug) } satisfies Project;
				if (project.published) bySlug[slug] = project;
			}
		}
	}

	return Object.values(bySlug).sort(
		(first, second) => new Date(second.year).getTime() - new Date(first.year).getTime()
	);
}

export async function GET() {
	const posts = await getProjects();
	return json(posts, {
		headers: {
			'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
		}
	});
}

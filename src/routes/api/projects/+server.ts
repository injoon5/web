export const prerender = true;

import { json } from '@sveltejs/kit';
import type { Project } from '$lib/types';

async function getProjects() {
	const enPaths = import.meta.glob('/src/routes/projects/projects/en/*.md', { eager: true });
	const koPaths = import.meta.glob('/src/routes/projects/projects/ko/*.md', { eager: true });

	const bySlug: Record<string, Project> = {};

	for (const [paths, lang] of [[koPaths, 'ko'], [enPaths, 'en']] as const) {
		for (const path in paths) {
			const file = paths[path];
			const slug = path.split('/').at(-1)?.replace('.md', '');
			if (file && typeof file === 'object' && 'metadata' in file && slug) {
				const metadata = file.metadata as Omit<Project, 'slug'>;
				const project = { ...metadata, slug } satisfies Project;
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
	return json(posts);
}

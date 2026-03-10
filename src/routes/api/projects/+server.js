export const prerender = true;

import { json } from '@sveltejs/kit';

async function getProjects() {
	let projects = [];

	const paths = import.meta.glob('/src/routes/projects/projects/*.md', {
		eager: true
	});

	for (const path in paths) {
		const file = paths[path];
		const slug = path.split('/').at(-1)?.replace('.md', '');

		if (file && typeof file === 'object' && 'metadata' in file && slug) {
			const metadata = file.metadata;
			const project = { ...metadata, slug };
			project.published && projects.push(project);
		}
	}

	projects = projects.sort(
		(first, second) => new Date(second.year).getTime() - new Date(first.year).getTime()
	);

	return projects;
}

export async function GET() {
	const posts = await getProjects();
	return json(posts);
}

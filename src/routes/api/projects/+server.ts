export const prerender = true;

import { json } from '@sveltejs/kit';
import type { Project } from '$lib/types';
import { resolvePublished, CONTENT_CACHE_CONTROL } from '$lib/server/content';

export async function GET() {
	const enPaths = import.meta.glob('/src/routes/projects/projects/en/*.md', { eager: true });
	const koPaths = import.meta.glob('/src/routes/projects/projects/ko/*.md', { eager: true });

	const projects = (resolvePublished(enPaths, koPaths) as Project[]).sort(
		(a, b) => new Date(b.year as string).getTime() - new Date(a.year as string).getTime()
	);

	return json(projects, { headers: { 'Cache-Control': CONTENT_CACHE_CONTROL } });
}

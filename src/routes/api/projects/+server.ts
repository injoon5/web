export const prerender = true;

import { json } from '@sveltejs/kit';
import type { Project } from '$lib/types';
import { resolvePublished, CONTENT_CACHE_CONTROL } from '$lib/server/content';
import { projectEnModules, projectKoModules } from '$lib/server/content-modules.js';

export async function GET() {
	const projects = (resolvePublished(projectEnModules, projectKoModules) as Project[]).sort(
		(a, b) => new Date(b.year as string).getTime() - new Date(a.year as string).getTime()
	);

	return json(projects, { headers: { 'Cache-Control': CONTENT_CACHE_CONTROL } });
}

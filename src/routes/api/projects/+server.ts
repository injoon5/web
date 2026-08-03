// Kept as a public endpoint in its own right — see the note in ../posts.
export const prerender = true;

import { json } from '@sveltejs/kit';
import { publishedProjects, CONTENT_CACHE_CONTROL } from '$lib/server/content';

export async function GET() {
	return json(publishedProjects(), { headers: { 'Cache-Control': CONTENT_CACHE_CONTROL } });
}

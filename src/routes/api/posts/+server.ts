export const prerender = true;

import { json } from '@sveltejs/kit';
import type { Post } from '$lib/types';
import { resolvePublished, CONTENT_CACHE_CONTROL } from '$lib/server/content';
import { blogEnModules, blogKoModules } from '$lib/server/content-modules.js';

export async function GET() {
	const posts = (resolvePublished(blogEnModules, blogKoModules) as Post[]).sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
	);

	return json(posts, { headers: { 'Cache-Control': CONTENT_CACHE_CONTROL } });
}

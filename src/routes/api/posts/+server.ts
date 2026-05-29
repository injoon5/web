export const prerender = true;

import { json } from '@sveltejs/kit';
import type { Post } from '$lib/types';
import { resolvePublished, CONTENT_CACHE_CONTROL } from '$lib/server/content';

export async function GET() {
	const enPaths = import.meta.glob('/src/routes/blog/posts/en/*.md', { eager: true });
	const koPaths = import.meta.glob('/src/routes/blog/posts/ko/*.md', { eager: true });

	const posts = (resolvePublished(enPaths, koPaths) as Post[]).sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
	);

	return json(posts, { headers: { 'Cache-Control': CONTENT_CACHE_CONTROL } });
}

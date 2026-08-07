// Kept as a public endpoint in its own right. The site's own pages no longer
// read the list through it — they call `publishedPosts()` directly — so this
// exists for anything outside the app that wants the feed as JSON.
export const prerender = true;

import { json } from '@sveltejs/kit';
import { publishedPosts, CONTENT_CACHE_CONTROL } from '$lib/server/content.js';

export async function GET() {
	return json(publishedPosts(), { headers: { 'Cache-Control': CONTENT_CACHE_CONTROL } });
}

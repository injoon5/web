export const prerender = true;

import { json } from '@sveltejs/kit';
import type { Book } from '$lib/types';
import { resolvePublished, CONTENT_CACHE_CONTROL } from '$lib/server/content';
import { bookEnModules, bookKoModules } from '$lib/server/content-modules.js';

export async function GET() {
	const books = (resolvePublished(bookEnModules, bookKoModules) as Book[]).sort((a, b) => {
		// Books still being read sit at the front of the shelf.
		if (!!a.reading !== !!b.reading) return a.reading ? -1 : 1;
		return new Date(b.date).getTime() - new Date(a.date).getTime();
	});

	return json(books, { headers: { 'Cache-Control': CONTENT_CACHE_CONTROL } });
}

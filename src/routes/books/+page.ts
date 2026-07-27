export const prerender = true;

import type { LoadEvent } from '@sveltejs/kit';

export const load = async ({ fetch }: LoadEvent) => {
	const response = await fetch(`/api/books`);
	const books = await response.json();

	return {
		books
	};
};

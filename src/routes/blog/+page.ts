export const prerender = true;

import type { LoadEvent } from "@sveltejs/kit";

export const load = async ({ fetch }: LoadEvent) => {
	const response = await fetch(`/api/posts`);
	const posts = await response.json();

	return {
		posts,
	};
};

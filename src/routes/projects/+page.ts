import type { LoadEvent } from '@sveltejs/kit';

export const load = async ({ fetch }: LoadEvent) => {
	const response = await fetch(`/api/projects`);
	const projects = await response.json();

	return {
		projects
	};
};

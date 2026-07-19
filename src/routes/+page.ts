import type { LoadEvent } from '@sveltejs/kit';

export const prerender = true;

export const load = async ({ fetch }: LoadEvent) => {
	const [postResponse, projectsResponse] = await Promise.all([
		fetch(`/api/posts`),
		fetch(`/api/projects`)
	]);
	const [posts, projects] = await Promise.all([postResponse.json(), projectsResponse.json()]);

	return {
		posts,
		projects
	};
};

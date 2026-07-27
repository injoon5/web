import type { LoadEvent } from '@sveltejs/kit';

export const prerender = true;

export const load = async ({ fetch }: LoadEvent) => {
	const [postResponse, projectsResponse, booksResponse] = await Promise.all([
		fetch(`/api/posts`),
		fetch(`/api/projects`),
		fetch(`/api/books`)
	]);
	const [posts, projects, books] = await Promise.all([
		postResponse.json(),
		projectsResponse.json(),
		booksResponse.json()
	]);

	return {
		posts,
		projects,
		books
	};
};

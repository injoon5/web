export const prerender = true;

import type { LoadEvent } from '@sveltejs/kit';

export const load = async ({ fetch }: LoadEvent) => {
	const postResponse = await fetch(`/api/posts`);
	const posts = await postResponse.json();

	const projectsResponse = await fetch(`/api/projects`);
	const projects = await projectsResponse.json();

	const nowlisteningResponse = await fetch(
		`https://raw.githubusercontent.com/injoon5/data/main/now-playing.json`
	);
	const nowlistening = await nowlisteningResponse.json();

	const photosResponse = await fetch(
		`https://raw.githubusercontent.com/injoon5/data/main/photos.json`
	);
	const photos = await photosResponse.json();

	return {
		posts,
		projects,
		nowlistening,
		photos
	};
};

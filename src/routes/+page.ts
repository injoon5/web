export const load = async ({ fetch }) => {
	const postResponse = await fetch(`/api/posts`);
	const posts = await postResponse.json();

	const projectsResponse = await fetch(`/api/projects`);
	const projects = await projectsResponse.json();

	const nowlisteningResponse = await fetch(
		`https://raw.githubusercontent.com/injoon5/now-playing/main/now-playing.json`
	);
	const nowlistening = await nowlisteningResponse.json();

	return {
		posts,
		projects,
		nowlistening
	};
};

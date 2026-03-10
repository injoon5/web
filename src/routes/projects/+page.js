export const prerender = true;

export const load = async ({ fetch }) => {
	const response = await fetch(`/api/projects`);
	const projects = await response.json();

	return {
		projects,
	};
};

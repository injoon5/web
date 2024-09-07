export const prerender = true;

import { error, type LoadEvent } from '@sveltejs/kit';

export async function load({ params }: LoadEvent) {
	try {
		// Dynamically import the markdown file based on the slug
		const project = await import(`../projects/${params.slug}.md`);

		// Return the content and metadata from the markdown file
		return {
			content: project.default,
			meta: project.metadata
		};
	} catch (e) {
		// Throw a 404 error if the project is not found
		throw error(404, `Could not find ${params.slug}`);
	}
}

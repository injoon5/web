import { error } from '@sveltejs/kit';

export async function load({ params }) {
	try {
		const project = await import(`../projects/${params.slug}.md`);
		return {
			content: project.default,
			meta: project.metadata
		};
	} catch (e) {
		throw error(404, `Could not find ${params.slug}`);
	}
}

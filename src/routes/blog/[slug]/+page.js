export const prerender = true;

import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
	try {
		const post = await import(`../posts/${params.slug}.md`);

		const response = await fetch('/api/posts');
		const posts = await response.json();

		const series = posts.filter(
			(tempPost) => tempPost.series === post.metadata.series,
		);

		return {
			content: post.default,
			meta: post.metadata,
			series: series,
		};
	} catch (e) {
		console.log(e);
		throw error(404, `Could not find ${params.slug}`);
	}
}

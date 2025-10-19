export const prerender = true;

import { error, type LoadEvent } from "@sveltejs/kit";

export async function load({ params, fetch }: LoadEvent) {
	try {
		// Dynamically import the markdown file based on the slug
		const post = await import(`../posts/${params.slug}.md`);

		// Use event.fetch instead of global fetch for relative URLs
		const response = await fetch("/api/posts");
		const posts = await response.json();

		// Filter the posts that belong to the same series
		const series = posts.filter(
			(tempPost: any) => tempPost.series === post.metadata.series,
		);

		return {
			content: post.default,
			meta: post.metadata,
			series: series,
		};
	} catch (e) {
		console.log(e);
		// Throw a 404 error if the post is not found
		throw error(404, `Could not find ${params.slug}`);
	}
}

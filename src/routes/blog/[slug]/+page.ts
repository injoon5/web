import { error } from '@sveltejs/kit';

export async function load({ params }) {
	try {
		const post = await import(`../posts/${params.slug}.md`);
		const posts = await (await fetch(`/api/posts`)).json();


		console.log(posts);
		return {
			content: post.default,
			meta: post.metadata,
			posts: posts
		};
	} catch (e) {
		throw error(404, `Could not find ${params.slug}`);
	}
}

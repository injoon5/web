export const prerender = true;

import { json } from "@sveltejs/kit";
import type { Post } from "$lib/types";

async function getPosts() {
	let posts: Post[] = [];

	const paths = import.meta.glob("/src/routes/blog/posts/**/*.md", {
		eager: true,
	});

	for (const path in paths) {
		const file = paths[path];
		const slug = path.split("/").at(-1)?.replace(".md", "");
		const langMatch = path.match(/\/posts\/([^/]+)\//);
		const lang = langMatch ? langMatch[1] : "en";

		if (file && typeof file === "object" && "metadata" in file && slug) {
			const metadata = file.metadata as Omit<Post, "slug">;
			const post = { ...metadata, slug, lang } satisfies Post;
			post.published && posts.push(post);
		}
	}

	posts = posts.sort(
		(first, second) =>
			new Date(second.date).getTime() - new Date(first.date).getTime(),
	);

	return posts;
}

export async function GET() {
	const posts = await getPosts();
	return json(posts);
}

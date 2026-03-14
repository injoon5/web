export const prerender = true;

import { json } from "@sveltejs/kit";
import type { Post } from "$lib/types";

async function getPosts() {
	const enPaths = import.meta.glob("/src/routes/blog/posts/en/*.md", { eager: true });
	const koPaths = import.meta.glob("/src/routes/blog/posts/ko/*.md", { eager: true });

	const bySlug: Record<string, Post> = {};

	for (const [paths, lang] of [[koPaths, "ko"], [enPaths, "en"]] as const) {
		for (const path in paths) {
			const file = paths[path];
			const slug = path.split("/").at(-1)?.replace(".md", "");
			if (file && typeof file === "object" && "metadata" in file && slug) {
				const metadata = file.metadata as Omit<Post, "slug">;
				const post = { ...metadata, slug } satisfies Post;
				if (post.published) bySlug[slug] = post;
			}
		}
	}

	return Object.values(bySlug).sort(
		(first, second) =>
			new Date(second.date).getTime() - new Date(first.date).getTime(),
	);
}

export async function GET() {
	const posts = await getPosts();
	return json(posts);
}

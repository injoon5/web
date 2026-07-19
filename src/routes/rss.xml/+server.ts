export const prerender = true;

import { create } from 'xmlbuilder2';
import { blogEnModules, blogKoModules } from '$lib/server/content-modules.js';

const SITE_URL = 'https://www.injoon5.com';

// Raw markdown sources for feed descriptions. The compiled modules above only
// carry metadata + a Svelte component, so the description text comes from the
// raw files (frontmatter stripped below).
const rawEn = import.meta.glob('/src/routes/blog/posts/en/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});
const rawKo = import.meta.glob('/src/routes/blog/posts/ko/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

// The same slug exists in both en/ and ko/, so dedupe by slug — preferring
// Korean (the site default, iterated last) — to avoid emitting two feed items
// that point at the same /blog/{slug} URL.
const getPosts = () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const bySlug: Record<string, any> = {};

	for (const [modules, raws] of [
		[blogEnModules, rawEn],
		[blogKoModules, rawKo]
	] as const) {
		for (const path in modules) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const meta = (modules[path] as any)?.metadata;
			if (meta?.published !== true) continue;

			const slug = path.split('/').at(-1)?.replace('.md', '') ?? '';
			const raw = (raws[path] as string) ?? '';
			bySlug[slug] = {
				...meta,
				slug,
				content: raw.replace(/^---[\s\S]+?---/, '') // Remove frontmatter
			};
		}
	}

	return Object.values(bySlug).sort(
		(first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()
	);
};

// Strip non-text markdown elements (images, links, HTML, code) for descriptions
const cleanText = (content: string) => {
	return content
		.replace(/`{3}[\s\S]*?`{3}/g, '') // Remove code blocks
		.replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
		.replace(/\[.*?\]\(.*?\)/g, '') // Remove links
		.replace(/<[^>]*>/g, '') // Remove HTML tags
		.replace(/`.*?`/g, '') // Remove inline code
		.trim();
};

// Short description from content (first 300 characters, blank lines removed)
const generateDescription = (content: string) => {
	const cleanedContent = cleanText(content);
	const truncatedContent =
		cleanedContent.length > 300 ? `${cleanedContent.substring(0, 300)}...` : cleanedContent;

	return truncatedContent
		.split('\n')
		.filter((line) => line.trim() !== '')
		.join('\n');
};

export const GET = async () => {
	const posts = getPosts();

	const feed = create({ version: '1.0', encoding: 'UTF-8' })
		.ele('rss', { version: '2.0' })
		.ele('channel')
		.ele('title')
		.txt("Injoon Oh's Website")
		.up()
		.ele('link')
		.txt(`${SITE_URL}/rss.xml`)
		.up()
		.ele('description')
		.txt('Latest blog articles')
		.up()
		.ele('language')
		.txt('ko-kr')
		.up();

	posts.forEach((post) => {
		feed
			.ele('item')
			.ele('title')
			.txt(post.title)
			.up()
			.ele('link')
			.txt(`${SITE_URL}/blog/${post.slug}`)
			.up()
			.ele('description')
			.txt(generateDescription(post.content))
			.up()
			.ele('pubDate')
			.txt(new Date(post.date).toUTCString())
			.up();
	});

	const xml = feed.end({ prettyPrint: true });

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=UTF-8'
		}
	});
};

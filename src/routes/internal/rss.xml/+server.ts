export const prerender = true;

import { create } from 'xmlbuilder2';
import fs from 'fs';
import path from 'path';
import { parseFrontmatter } from '$lib/server/frontmatter.js';

// Define the path to your blog posts directory
const postsDir = path.resolve('src/routes/blog/posts/');

// Recursively collect all .md file paths under a directory
const collectMdFiles = (dir) => {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	return entries.flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return collectMdFiles(full);
		if (entry.isFile() && entry.name.endsWith('.md')) return [full];
		return [];
	});
};

// Function to fetch all posts. The same slug exists in both en/ and ko/, so we
// dedupe by slug — preferring Korean (the site default) — to avoid emitting two
// feed items that point at the same /blog/{slug} URL.
const getPosts = () => {
	const files = collectMdFiles(postsDir);
	const bySlug: Record<string, any> = {};

	for (const file of files) {
		const content = fs.readFileSync(file, 'utf-8');
		const match = /---\s*([\s\S]+?)\s*---/.exec(content);
		if (!match) continue;

		const meta: any = parseFrontmatter(match[1]);
		if (meta.published !== true) continue;

		meta.slug = path.basename(file, '.md');
		meta.content = content.replace(/---[\s\S]+?---/, ''); // Remove frontmatter

		const isKo = /[/\\]ko[/\\]/.test(file);
		if (!bySlug[meta.slug] || isKo) bySlug[meta.slug] = meta;
	}

	return Object.values(bySlug).sort(
		(first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()
	);
};

// Function to clean up content by stripping non-text elements (e.g., images, embeds)
const cleanText = (content) => {
	return content
		.replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
		.replace(/\[.*?\]\(.*?\)/g, '') // Remove links
		.replace(/<[^>]*>/g, '') // Remove HTML tags
		.replace(/`{3}[\s\S]*?`{3}/g, '') // Remove code blocks
		.replace(/`.*?`/g, '') // Remove inline code
		.trim();
};

// Function to generate a short description from content (first 300 characters)
const generateDescription = (content) => {
	const cleanedContent = cleanText(content);
	let truncatedContent =
		cleanedContent.length > 300 ? `${cleanedContent.substring(0, 300)}...` : cleanedContent;

	// Remove blank lines
	truncatedContent = truncatedContent
		.split('\n')
		.filter((line) => line.trim() !== '')
		.join('\n');

	return truncatedContent;
};

export const GET = async () => {
	const posts = getPosts();

	// Build the RSS feed with UTF-8 encoding
	const feed = create({ version: '1.0', encoding: 'UTF-8' })
		.ele('rss', { version: '2.0' })
		.ele('channel')
		.ele('title')
		.txt("Injoon Oh's Website")
		.up()
		.ele('link')
		.txt('https://www.injoon5.com/rss.xml')
		.up()
		.ele('description')
		.txt('Latest blog articles')
		.up()
		.ele('language')
		.txt('ko-kr')
		.up();

	posts.forEach((post) => {
		const postUrl = `https://www.injoon5.com/blog/${post.slug}`;
		const description = generateDescription(post.content); // Generate description

		feed
			.ele('item')
			.ele('title')
			.txt(post.title)
			.up()
			.ele('link')
			.txt(postUrl)
			.up()
			.ele('description')
			.txt(description)
			.up()
			.ele('pubDate')
			.txt(new Date(post.date).toUTCString())
			.up();
	});

	const xml = feed.end({ prettyPrint: true });

	// Return the response with UTF-8 encoding
	return new Response(xml, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=UTF-8'
		}
	});
};

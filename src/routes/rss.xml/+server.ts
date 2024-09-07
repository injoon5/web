import { create } from 'xmlbuilder2';
import fs from 'fs';
import path from 'path';

// Define the path to your blog posts directory
const postsDir = path.resolve('src/routes/blog/posts/');

// Function to fetch all posts
const getPosts = () => {
	const files = fs.readdirSync(postsDir);
	return files
		.map((file) => {
			const content = fs.readFileSync(path.join(postsDir, file), 'utf-8');
			const match = /---\s*([\s\S]+?)\s*---/.exec(content);
			if (match) {
				const frontmatter = match[1];
				const meta = Object.fromEntries(
					frontmatter
						.split('\n')
						.filter((line) => line.includes(':'))
						.map((line) => {
							const [key, value] = line.split(':');
							return [key.trim(), value.replace(/['"]/g, '').trim()];
						})
				);

				meta.slug = file.replace('.md', '');
				meta.content = content.replace(/---[\s\S]+?---/, ''); // Remove frontmatter
				return meta;
			}
		})
		.filter((post) => post && post.published);
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

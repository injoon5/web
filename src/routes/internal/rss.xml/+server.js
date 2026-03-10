import { create } from 'xmlbuilder2';
import fs from 'fs';
import path from 'path';

const postsDir = path.resolve('src/routes/blog/posts/');

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
						}),
				);

				meta.slug = file.replace('.md', '');
				meta.content = content.replace(/---[\s\S]+?---/, '');
				return meta;
			}
		})
		.filter((post) => post && post.published);
};

const cleanText = (content) => {
	return content
		.replace(/!\[.*?\]\(.*?\)/g, '')
		.replace(/\[.*?\]\(.*?\)/g, '')
		.replace(/<[^>]*>/g, '')
		.replace(/`{3}[\s\S]*?`{3}/g, '')
		.replace(/`.*?`/g, '')
		.trim();
};

const generateDescription = (content) => {
	const cleanedContent = cleanText(content);
	let truncatedContent =
		cleanedContent.length > 300
			? `${cleanedContent.substring(0, 300)}...`
			: cleanedContent;

	truncatedContent = truncatedContent
		.split('\n')
		.filter((line) => line.trim() !== '')
		.join('\n');

	return truncatedContent;
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
		const description = generateDescription(post.content);

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

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=UTF-8',
		},
	});
};

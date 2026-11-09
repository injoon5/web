export const prerender = true;

import { create } from 'xmlbuilder2';
import { SITE_URL, articleBase } from '#lib/content/article-paths.js';
import { catalogue, primaryMeta } from '#lib/server/catalogue.js';

// Raw markdown sources for feed descriptions. The compiled modules only carry
// metadata + a Svelte component, so the description text comes from the raw
// files (frontmatter stripped below).
const raw = {
	en: import.meta.glob('/src/content/blog/en/*.md', {
		query: '?raw',
		import: 'default',
		eager: true
	}),
	ko: import.meta.glob('/src/content/blog/ko/*.md', {
		query: '?raw',
		import: 'default',
		eager: true
	})
};

/** One item per post, in its primary language, newest first. */
const getPosts = () =>
	catalogue.blog.map((post) => {
		const lang = post.langs[0];
		const source = /** @type {string} */ (
			raw[lang][`/src/content/blog/${lang}/${post.slug}.md`] ?? ''
		);
		return {
			...primaryMeta(post),
			link: SITE_URL + articleBase('blog', post.slug),
			content: source.replace(/^---[\s\S]+?---/, '')
		};
	});

/** @param {string} content */
const cleanText = (content) => {
	return content
		.replace(/`{3}[\s\S]*?`{3}/g, '')
		.replace(/!\[.*?\]\(.*?\)/g, '')
		.replace(/\[.*?\]\(.*?\)/g, '')
		.replace(/<[^>]*>/g, '')
		.replace(/`.*?`/g, '')
		.trim();
};

/** @param {string} content */
const generateDescription = (content) => {
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
		// RSS 2.0: the channel's <link> is the site the feed describes, not the feed.
		.ele('link')
		.txt(SITE_URL)
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
			.txt(post.link)
			.up()
			// Readers dedupe on guid; without one, some re-show every item when
			// any field (a description's 300 characters) changes.
			.ele('guid', { isPermaLink: 'true' })
			.txt(post.link)
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

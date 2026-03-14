const enBlogPaths = import.meta.glob('/src/routes/blog/posts/en/*.md', { eager: true });
const koBlogPaths = import.meta.glob('/src/routes/blog/posts/ko/*.md', { eager: true });
const enProjectPaths = import.meta.glob('/src/routes/projects/projects/en/*.md', { eager: true });
const koProjectPaths = import.meta.glob('/src/routes/projects/projects/ko/*.md', { eager: true });

const validUrls = new Set();

for (const [paths, prefix] of [
	[enBlogPaths, '/blog/'],
	[koBlogPaths, '/blog/'],
	[enProjectPaths, '/projects/'],
	[koProjectPaths, '/projects/']
]) {
	for (const path in paths) {
		const file = paths[path];
		const slug = path.split('/').at(-1)?.replace('.md', '');
		if (slug && file?.metadata?.published) validUrls.add(prefix + slug);
	}
}

/** @param {string} url */
export function isValidPageUrl(url) {
	return validUrls.has(url);
}

// @ts-check
import { blogPostingSchema, projectSchema } from '$lib/seo/jsonld.js';
import { SITE_URL } from './sitemap.js';
import { blogEnMeta, blogKoMeta, projectEnMeta, projectKoMeta } from './content-modules.js';
import { publishedPosts, publishedProjects } from './content.js';
import { normalizePathname } from './markdown-negotiation.js';
import {
	absolutizeMarkdown,
	coverUrl,
	healthMarkdown,
	homeMarkdown,
	listingMarkdown,
	notFoundMarkdown,
	nowMarkdown,
	pickArticle,
	withJsonLd
} from './markdown-format.js';

const rawBlogEn = import.meta.glob('/src/content/blog/en/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});
const rawBlogKo = import.meta.glob('/src/content/blog/ko/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});
const rawProjectEn = import.meta.glob('/src/content/projects/en/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});
const rawProjectKo = import.meta.glob('/src/content/projects/ko/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

const SLUG = /^[a-z0-9-]+$/;
const CONTENT_ROUTE = /^\/(blog|projects)\/([a-z0-9-]+)$/;

/**
 * @param {'blog' | 'projects'} kind
 * @param {string} slug
 * @param {string | null | undefined} langPref
 */
function articleMarkdown(kind, slug, langPref) {
	const picked =
		kind === 'blog'
			? pickArticle(rawBlogEn, rawBlogKo, blogEnMeta, blogKoMeta, 'blog', slug, langPref)
			: pickArticle(
					rawProjectEn,
					rawProjectKo,
					projectEnMeta,
					projectKoMeta,
					'projects',
					slug,
					langPref
				);
	if (!picked) return null;

	const url = `${SITE_URL}/${kind}/${slug}`;
	const image = coverUrl(/** @type {string | undefined} */ (picked.meta.coverimage));
	const schema =
		kind === 'blog'
			? blogPostingSchema({
					title: String(picked.meta.title ?? slug),
					description: /** @type {string | undefined} */ (picked.meta.description),
					date: /** @type {string | undefined} */ (picked.meta.date),
					url,
					image,
					lang: picked.lang,
					keywords: /** @type {string[] | undefined} */ (picked.meta.keywords),
					section: /** @type {string | undefined} */ (picked.meta.series)
				})
			: projectSchema({
					title: String(picked.meta.title ?? slug),
					description: /** @type {string | undefined} */ (picked.meta.description),
					year: /** @type {string | undefined} */ (picked.meta.year),
					url,
					image,
					lang: picked.lang,
					keywords: /** @type {string[] | undefined} */ (picked.meta.keywords)
				});

	return withJsonLd(absolutizeMarkdown(picked.raw, SITE_URL), schema);
}

/**
 * Markdown for a public page pathname, or `null` when this resolver should
 * stand aside (APIs, assets, admin, unknown paths that are not content slugs).
 *
 * @param {string} pathname
 * @param {{ lang?: string | null }} [opts]
 * @returns {{ body: string, status: number } | null}
 */
export function markdownForPath(pathname, opts = {}) {
	const path = normalizePathname(pathname);
	const lang = opts.lang;

	if (path === '/') {
		return {
			body: homeMarkdown({ posts: publishedPosts(), projects: publishedProjects() }),
			status: 200
		};
	}
	if (path === '/blog') {
		return {
			body: listingMarkdown({
				title: 'Blog',
				description:
					"Stuff that just barely made it online. Take a look at what I've done, experienced, and wrote about.",
				items: publishedPosts().map((post) => ({
					title: post.title,
					href: `${SITE_URL}/blog/${post.slug}`,
					description: post.description,
					when: post.date
				}))
			}),
			status: 200
		};
	}
	if (path === '/projects') {
		return {
			body: listingMarkdown({
				title: 'Projects',
				description:
					'Some of the stuff I did to escape from a boring day. Everything from school projects to personal projects.',
				items: publishedProjects().map((project) => ({
					title: project.title,
					href: `${SITE_URL}/projects/${project.slug}`,
					description: project.description,
					when: project.year
				}))
			}),
			status: 200
		};
	}
	if (path === '/now') return { body: nowMarkdown(), status: 200 };
	if (path === '/health') return { body: healthMarkdown(), status: 200 };

	const content = path.match(CONTENT_ROUTE);
	if (content) {
		const kind = /** @type {'blog' | 'projects'} */ (content[1]);
		const slug = content[2];
		if (!SLUG.test(slug)) return { body: notFoundMarkdown(path), status: 404 };
		const body = articleMarkdown(kind, slug, lang);
		if (!body) return { body: notFoundMarkdown(path), status: 404 };
		return { body, status: 200 };
	}

	return null;
}

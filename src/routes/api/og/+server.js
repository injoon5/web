import { renderOgImage } from '$lib/og/render.js';
import {
	homeTemplate,
	blogListTemplate,
	blogPostTemplate,
	projectsListTemplate,
	projectTemplate,
	nowTemplate
} from '$lib/og/templates.js';

const ONE_DAY = 60 * 60 * 24;
const ONE_WEEK = ONE_DAY * 7;

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const template = url.searchParams.get('template') || 'home';
	const title = url.searchParams.get('title') || '';
	const description = url.searchParams.get('description') || '';
	const date = url.searchParams.get('date') || '';
	const year = url.searchParams.get('year') || '';
	const tags = url.searchParams.get('tags') || '';

	let element;

	switch (template) {
		case 'home':
			element = homeTemplate();
			break;
		case 'blog':
			element = blogListTemplate();
			break;
		case 'blog-post':
			element = blogPostTemplate({ title, description, date });
			break;
		case 'projects':
			element = projectsListTemplate();
			break;
		case 'project':
			element = projectTemplate({
				title,
				description,
				year,
				tags: tags ? tags.split(',').map((t) => t.trim()) : []
			});
			break;
		case 'now':
			element = nowTemplate();
			break;
		default:
			element = homeTemplate();
	}

	const png = await renderOgImage(element);

	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': `public, max-age=${ONE_DAY}, s-maxage=${ONE_WEEK}, stale-while-revalidate=${ONE_DAY}`
		}
	});
}

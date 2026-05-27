import { OG_FIXTURES } from './fixtures.js';
import {
	homeTemplate,
	blogListTemplate,
	blogPostTemplate,
	projectsListTemplate,
	projectTemplate,
	nowTemplate
} from './templates.js';

/**
 * @param {URLSearchParams} searchParams
 */
export function resolveOgInput(searchParams) {
	const fixtureId = searchParams.get('fixture');
	if (fixtureId && OG_FIXTURES[fixtureId]) {
		return { ...OG_FIXTURES[fixtureId] };
	}

	return {
		template: searchParams.get('template') || 'home',
		title: searchParams.get('title') || '',
		description: searchParams.get('description') || '',
		date: searchParams.get('date') || '',
		year: searchParams.get('year') || '',
		tags: searchParams.get('tags')
			? searchParams
					.get('tags')
					.split(',')
					.map((t) => t.trim())
					.filter(Boolean)
			: []
	};
}

/**
 * @param {{ template: string, title?: string, description?: string, date?: string, year?: string, tags?: string[] }} input
 */
export function buildOgElement(input) {
	const { template, title = '', description = '', date = '', year = '', tags = [] } = input;

	switch (template) {
		case 'home':
			return homeTemplate();
		case 'blog':
			return blogListTemplate();
		case 'blog-post':
			return blogPostTemplate({ title, description, date });
		case 'projects':
			return projectsListTemplate();
		case 'project':
			return projectTemplate({ title, description, year, tags });
		case 'now':
			return nowTemplate();
		default:
			return homeTemplate();
	}
}

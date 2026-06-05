import { OG_FIXTURES } from './fixtures.js';
import {
	homeTemplate,
	blogListTemplate,
	blogPostTemplate,
	projectsListTemplate,
	projectTemplate,
	nowTemplate
} from './templates.js';

// Bound every free-form input before it reaches satori/resvg. This route is
// public and unmetered, so unbounded query params would let a caller force
// arbitrarily expensive PNG renders.
const MAX_OG_TEXT = 200;
const MAX_OG_TAGS = 8;
const MAX_OG_TAG_LENGTH = 40;

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
		title: (searchParams.get('title') || '').slice(0, MAX_OG_TEXT),
		description: (searchParams.get('description') || '').slice(0, MAX_OG_TEXT),
		date: (searchParams.get('date') || '').slice(0, MAX_OG_TEXT),
		year: (searchParams.get('year') || '').slice(0, MAX_OG_TEXT),
		tags: searchParams.get('tags')
			? searchParams
					.get('tags')
					.split(',')
					.map((t) => t.trim().slice(0, MAX_OG_TAG_LENGTH))
					.filter(Boolean)
					.slice(0, MAX_OG_TAGS)
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

import { SITE_URL } from '#lib/content/article-paths.js';

/**
 * The absolute URL of a page's social card: `/api/og`, whose query string
 * `resolveOgInput` (./build.js) reads back.
 *
 * @param {string} template
 * @param {{ title?: string, description?: string, date?: string, year?: string, tags?: string[] }} [fields]
 */
export function ogImageUrl(template, fields = {}) {
	const params = new URLSearchParams({ template });
	for (const [key, value] of Object.entries(fields)) {
		params.set(key, Array.isArray(value) ? value.join(',') : (value ?? ''));
	}
	return `${SITE_URL}/api/og?${params}`;
}

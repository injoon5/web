import { blogEnMeta, blogKoMeta, projectEnMeta, projectKoMeta } from './content-modules.js';
import { resolvePublished } from './content';

const validUrls = new Set();

for (const item of resolvePublished(blogEnMeta, blogKoMeta)) {
	validUrls.add('/blog/' + item.slug);
}
for (const item of resolvePublished(projectEnMeta, projectKoMeta)) {
	validUrls.add('/projects/' + item.slug);
}

/** @param {string} url */
export function isValidPageUrl(url) {
	return validUrls.has(url);
}

import {
	blogEnModules,
	blogKoModules,
	projectEnModules,
	projectKoModules
} from './content-modules.js';
import { resolvePublished } from './content';

const validUrls = new Set();

for (const item of resolvePublished(blogEnModules, blogKoModules)) {
	validUrls.add('/blog/' + item.slug);
}
for (const item of resolvePublished(projectEnModules, projectKoModules)) {
	validUrls.add('/projects/' + item.slug);
}

/** @param {string} url */
export function isValidPageUrl(url) {
	return validUrls.has(url);
}

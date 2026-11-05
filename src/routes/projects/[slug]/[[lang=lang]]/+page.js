// Prerendered: a static file per language from the CDN, and no function behind
// a client-side navigation either. The language is the URL, so nothing about
// the visitor is needed to render it. See `#lib/article/article-load.js`.
export const prerender = true;

import { articleLoad } from '#lib/article/article-load.js';

export const load = articleLoad('projects');

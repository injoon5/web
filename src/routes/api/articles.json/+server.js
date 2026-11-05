// Prerendered: which languages every article has, and each post's series lists.
// The article loads read this instead of importing every content chunk to find
// out (`#lib/server/article-index.js`), once per browser session.
export const prerender = true;

import { articleIndex } from '#lib/server/article-index.js';

export function GET() {
	return Response.json(articleIndex);
}

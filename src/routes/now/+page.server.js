// Incremental Static Regeneration, like the home page: the content changes only
// when the owner edits it, so it is rendered into the HTML at most every 5
// minutes instead of being fetched over the Convex websocket and rendered in the
// browser (marked + DOMPurify, ~24KB) before anything showed. The page still
// subscribes, seeded with this, so an edit appears on open pages straight away.
export const config = { isr: { expiration: 300 } };

import { queryOrNull } from '#lib/server/convex.js';
import { api } from '#convex/_generated/api.js';
import { renderNow } from '#lib/now/render-markdown.js';

export const load = async () => {
	const doc = await queryOrNull(api.now.get);
	const now = doc ? { content: doc.content, updatedAt: doc.updatedAt } : null;
	return { now, html: renderNow(now?.content) };
};

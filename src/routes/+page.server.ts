// Prerendered, and the content is build-time constant — so the lists are read
// straight from the metadata globs rather than fetched back out of
// `/api/posts`. A server load keeps those globs off the client entirely, and
// the result rides along in the prerendered data payload.
export const prerender = true;

import { publishedPosts, publishedProjects } from '$lib/server/content';

export const load = () => ({
	posts: publishedPosts(),
	projects: publishedProjects()
});

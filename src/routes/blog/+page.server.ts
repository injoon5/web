export const prerender = true;

import { publishedPosts } from '$lib/server/content';

export const load = () => ({ posts: publishedPosts() });

export const prerender = true;

import { publishedPosts } from '$lib/server/content.js';

export const load = () => ({ posts: publishedPosts() });

export const prerender = true;

import { publishedProjects } from '$lib/server/content.js';

export const load = () => ({ projects: publishedProjects() });

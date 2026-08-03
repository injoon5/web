export const prerender = true;

import { publishedProjects } from '$lib/server/content';

export const load = () => ({ projects: publishedProjects() });

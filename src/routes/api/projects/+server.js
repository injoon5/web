// Kept as a public endpoint in its own right — see the note in ../posts.
export const prerender = true;

import { publishedProjects } from '#lib/server/content.js';

export async function GET() {
	return Response.json(publishedProjects());
}

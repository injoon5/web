import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

if (!PUBLIC_CONVEX_URL) {
	throw new Error('PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to provision a deployment.');
}

export const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

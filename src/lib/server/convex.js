import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

export const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { CONVEX_URL } from '$env/static/private';

// Single shared Convex HTTP client for all server-side API route calls.
// anyApi provides type-free function references without needing the generated
// _generated/api.js file — it resolves function paths at runtime via a Proxy.
export const convex = new ConvexHttpClient(CONVEX_URL);
export const api = anyApi;

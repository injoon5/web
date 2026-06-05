import { building } from '$app/environment';
import type { LayoutServerLoad } from './$types';
import { getClientIp, hashIp } from '$lib/server/ip';

export const load: LayoutServerLoad = async ({ request }) => {
	// During prerendering there is no real client request, so don't bake a fixed
	// build-time ipHash (the hash of 127.0.0.1) into static HTML. Per-visitor
	// state is only used on the SSR (prerender = false) blog/project pages, where
	// this load runs per request and returns the visitor's real hash.
	if (building) return { ipHash: null };
	return { ipHash: hashIp(getClientIp(request)) };
};

import type { LayoutServerLoad } from './$types';
import { getClientIp, hashIp } from '$lib/server/ip';

export const load: LayoutServerLoad = async ({ request }) => {
	return { ipHash: hashIp(getClientIp(request)) };
};

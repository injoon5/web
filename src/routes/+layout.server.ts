import { getClientIp, hashIp } from '$lib/server/ip';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ request }) => ({
	ipHash: hashIp(getClientIp(request))
});

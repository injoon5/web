import { getClientIp, hashIp } from '$lib/server/ip';

export async function load({ request }) {
	const ip = getClientIp(request);
	const ipHash = hashIp(ip);
	return { ipHash };
}

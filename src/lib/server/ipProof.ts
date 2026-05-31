import { createHmac } from 'crypto';
import { IP_HASH_SECRET } from '$env/static/private';

const PURPOSE = 'ip:';

/** HMAC proof that ipHash came from our server API (not a forged Convex client call). */
export function createIpProof(ipHash: string): string {
	if (!IP_HASH_SECRET) {
		throw new Error('IP_HASH_SECRET is not set');
	}
	return createHmac('sha256', IP_HASH_SECRET)
		.update(PURPOSE + ipHash)
		.digest('hex');
}

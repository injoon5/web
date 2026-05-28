import { createHmac } from 'crypto';
import { IP_HASH_SECRET } from '$env/static/private';

export function getClientIp(request: Request): string {
	// Prefer x-real-ip: on Vercel (and most reverse proxies) it is set by the
	// platform from the TCP connection and is not overridable by the caller.
	// The leftmost x-forwarded-for entry is attacker-controlled, so trusting it
	// first lets a caller forge a fresh identity per request — inflating like
	// counts and evading per-IP bans and rate limits.
	const realIp = request.headers.get('x-real-ip');
	if (realIp) return realIp.trim();

	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) return forwarded.split(',')[0].trim();

	return '127.0.0.1';
}

export function hashIp(ip: string): string {
	if (!IP_HASH_SECRET) {
		throw new Error('IP_HASH_SECRET is not set');
	}
	return createHmac('sha256', IP_HASH_SECRET).update(ip).digest('hex');
}

/** Convenience: extract and hash the client IP from a request in one call. */
export function requestIpHash(request: Request): string {
	return hashIp(getClientIp(request));
}

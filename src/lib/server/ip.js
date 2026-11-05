// @ts-check
import { createHmac } from 'crypto';
import { IP_HASH_SECRET } from '$app/env/private';

// Cloudflare's published ranges (https://www.cloudflare.com/ips/). The site is
// proxied through Cloudflare, so the connection Vercel sees — and reports as
// x-real-ip — is a Cloudflare edge, a different one from request to request.
// Measured in production: one client, six requests, five different hashes.
const CLOUDFLARE_V4 = [
	'173.245.48.0/20',
	'103.21.244.0/22',
	'103.22.200.0/22',
	'103.31.4.0/22',
	'141.101.64.0/18',
	'108.162.192.0/18',
	'190.93.240.0/20',
	'188.114.96.0/20',
	'197.234.240.0/22',
	'198.41.128.0/17',
	'162.158.0.0/15',
	'104.16.0.0/13',
	'104.24.0.0/14',
	'172.64.0.0/13',
	'131.0.72.0/22'
];
const CLOUDFLARE_V6 = [
	'2400:cb00::/32',
	'2606:4700::/32',
	'2803:f800::/32',
	'2405:b500::/32',
	'2405:8100::/32',
	'2a06:98c0::/29',
	'2c0f:f248::/32'
];

/**
 * @param {string} ip
 * @returns {bigint | null}
 */
function v4ToBigInt(ip) {
	const parts = ip.split('.');
	if (parts.length !== 4) return null;
	let n = 0n;
	for (const p of parts) {
		if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
		n = (n << 8n) | BigInt(p);
	}
	return n;
}

/**
 * @param {string} ip
 * @returns {bigint | null}
 */
function v6ToBigInt(ip) {
	const halves = ip.toLowerCase().split('::');
	if (halves.length > 2) return null;
	const head = halves[0] ? halves[0].split(':') : [];
	const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
	const missing = 8 - head.length - tail.length;
	if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
	const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
	let n = 0n;
	for (const g of groups) {
		if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
		n = (n << 16n) | BigInt(parseInt(g, 16));
	}
	return n;
}

/**
 * @param {string} ip
 * @param {string[]} cidrs
 * @param {(ip: string) => bigint | null} parse
 * @param {bigint} bits
 */
function inRanges(ip, cidrs, parse, bits) {
	const addr = parse(ip);
	if (addr === null) return false;
	return cidrs.some((cidr) => {
		const [base, len] = cidr.split('/');
		const shift = bits - BigInt(len);
		const net = parse(base);
		return net !== null && addr >> shift === net >> shift;
	});
}

/** @param {string} ip */
export function isCloudflareIp(ip) {
	return ip.includes(':')
		? inRanges(ip, CLOUDFLARE_V6, v6ToBigInt, 128n)
		: inRanges(ip, CLOUDFLARE_V4, v4ToBigInt, 32n);
}

/**
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
	// Prefer x-real-ip: on Vercel (and most reverse proxies) it is set by the
	// platform from the TCP connection and is not overridable by the caller.
	// The leftmost x-forwarded-for entry is attacker-controlled, so trusting it
	// first lets a caller forge a fresh identity per request — inflating like
	// counts and evading per-IP bans and rate limits.
	const realIp = request.headers.get('x-real-ip')?.trim();
	if (realIp) {
		// When that connection is Cloudflare's, the visitor is the address it
		// forwards. Only then: a request sent straight to the Vercel domain can
		// carry any cf-connecting-ip it likes, but not a Cloudflare source address.
		const viaCloudflare = request.headers.get('cf-connecting-ip')?.trim();
		if (viaCloudflare && isCloudflareIp(realIp)) return viaCloudflare;
		return realIp;
	}

	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) return forwarded.split(',')[0].trim();

	return '127.0.0.1';
}

/**
 * @param {string} ip
 * @returns {string}
 */
export function hashIp(ip) {
	if (!IP_HASH_SECRET) {
		throw new Error('IP_HASH_SECRET is not set');
	}
	return createHmac('sha256', IP_HASH_SECRET).update(ip).digest('hex');
}

/**
 * Convenience: extract and hash the client IP from a request in one call.
 * @param {Request} request
 * @returns {string}
 */
export function requestIpHash(request) {
	return hashIp(getClientIp(request));
}

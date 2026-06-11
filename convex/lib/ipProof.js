import { ConvexError } from 'convex/values';

const PURPOSE = 'ip:';

async function hmacHex(secret, message) {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Must match src/lib/server/ipProof.ts (Node crypto). */
export async function expectedIpProof(ipHash) {
	const secret = process.env.IP_HASH_SECRET;
	if (!secret || !ipHash) return null;
	return hmacHex(secret, PURPOSE + ipHash);
}

/** Reject writes where ipHash was not issued by our SvelteKit API layer. */
export async function assertIpProof(ipHash, ipProof) {
	const expected = await expectedIpProof(ipHash);
	if (!expected || !ipProof) {
		throw new ConvexError({ kind: 'Forbidden', message: 'Invalid request' });
	}

	if (ipProof.length !== expected.length) {
		throw new ConvexError({ kind: 'Forbidden', message: 'Invalid request' });
	}

	let diff = 0;
	for (let i = 0; i < expected.length; i++) {
		diff |= ipProof.charCodeAt(i) ^ expected.charCodeAt(i);
	}
	if (diff !== 0) {
		throw new ConvexError({ kind: 'Forbidden', message: 'Invalid request' });
	}
}

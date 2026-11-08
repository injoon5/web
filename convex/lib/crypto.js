/** Web Crypto helpers for the Convex V8 runtime, which has no Node `crypto`. */

const encoder = new TextEncoder();

/** @param {ArrayBuffer} buffer */
function hex(buffer) {
	return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** HMAC-SHA256 of `message` under `key`, as lowercase hex. */
export async function hmacHex(key, message) {
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		encoder.encode(key),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return hex(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)));
}

/** SHA-256 of `text`, as lowercase hex. */
export async function sha256Hex(text) {
	return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

/**
 * Whether `candidate` equals `secret`, in time independent of where they
 * differ: both are HMAC'd under `secret` first, so what is compared is always
 * two digests of equal length.
 */
export async function secretsMatch(candidate, secret) {
	if (!secret || !candidate) return false;
	const [a, b] = await Promise.all([hmacHex(secret, candidate), hmacHex(secret, secret)]);
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

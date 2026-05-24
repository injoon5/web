/** Constant-time HMAC-SHA256 comparison for admin secrets (Convex V8 runtime). */
export async function secretsMatch(candidate, secret) {
	if (!secret || !candidate) return false;

	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const sigA = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(candidate)));
	const sigB = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(secret)));

	if (sigA.length !== sigB.length) return false;

	let diff = 0;
	for (let i = 0; i < sigA.length; i++) {
		diff |= sigA[i] ^ sigB[i];
	}
	return diff === 0;
}

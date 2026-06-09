import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { IP_HASH_SECRET } from '$env/static/private';
import { createIpProof } from './ipProof';

describe('createIpProof', () => {
	it('returns a deterministic 64-char hex HMAC for an ipHash', () => {
		const proof = createIpProof('abc123');
		expect(proof).toMatch(/^[0-9a-f]{64}$/);
		expect(createIpProof('abc123')).toBe(proof);
	});

	it('matches the Convex-side algorithm (purpose prefix + ipHash)', () => {
		const ipHash = 'deadbeef';
		const expected = createHmac('sha256', IP_HASH_SECRET)
			.update('ip:' + ipHash)
			.digest('hex');
		expect(createIpProof(ipHash)).toBe(expected);
	});

	it('produces different proofs for different ipHashes', () => {
		expect(createIpProof('a')).not.toBe(createIpProof('b'));
	});
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getClientIp, hashIp, requestIpHash, isCloudflareIp } from './ip.js';

function reqWith(headers) {
	return new Request('http://x/api', { headers });
}

describe('getClientIp', () => {
	it('prefers x-real-ip (platform-set, not caller-spoofable)', () => {
		const req = reqWith({ 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '1.2.3.4' });
		expect(getClientIp(req)).toBe('203.0.113.5');
	});

	it('trims whitespace from x-real-ip', () => {
		expect(getClientIp(reqWith({ 'x-real-ip': '  203.0.113.5  ' }))).toBe('203.0.113.5');
	});

	it('uses the leftmost x-forwarded-for entry when x-real-ip is absent', () => {
		expect(getClientIp(reqWith({ 'x-forwarded-for': '198.51.100.7, 10.0.0.1, 10.0.0.2' }))).toBe(
			'198.51.100.7'
		);
	});

	it('takes cf-connecting-ip when the connection is a Cloudflare edge', () => {
		const req = reqWith({ 'x-real-ip': '172.70.1.2', 'cf-connecting-ip': '203.0.113.9' });
		expect(getClientIp(req)).toBe('203.0.113.9');
		const v6 = reqWith({ 'x-real-ip': '2a06:98c1:3120::3', 'cf-connecting-ip': '2001:db8::1' });
		expect(getClientIp(v6)).toBe('2001:db8::1');
	});

	it('ignores cf-connecting-ip from anything that is not Cloudflare', () => {
		const req = reqWith({ 'x-real-ip': '203.0.113.5', 'cf-connecting-ip': '198.51.100.1' });
		expect(getClientIp(req)).toBe('203.0.113.5');
	});

	it('falls back to loopback when no forwarding headers exist', () => {
		expect(getClientIp(reqWith({}))).toBe('127.0.0.1');
	});
});

describe('hashIp', () => {
	it('is deterministic and returns a 64-char sha256 hex digest', () => {
		const a = hashIp('203.0.113.5');
		expect(a).toMatch(/^[0-9a-f]{64}$/);
		expect(hashIp('203.0.113.5')).toBe(a);
	});

	it('produces different digests for different IPs', () => {
		expect(hashIp('203.0.113.5')).not.toBe(hashIp('203.0.113.6'));
	});
});

describe('requestIpHash', () => {
	// The bug this replaced: hashing the Cloudflare edge gave one visitor a new
	// identity on most requests.
	it('gives one visitor the same hash through different Cloudflare edges', () => {
		const via = (edge) => reqWith({ 'x-real-ip': edge, 'cf-connecting-ip': '203.0.113.9' });
		expect(requestIpHash(via('172.70.1.2'))).toBe(requestIpHash(via('162.158.4.4')));
		expect(requestIpHash(via('172.70.1.2'))).not.toBe(
			requestIpHash(reqWith({ 'x-real-ip': '172.70.1.2' }))
		);
	});
});

describe('when IP_HASH_SECRET is not configured', () => {
	afterEach(() => {
		vi.resetModules();
		vi.doUnmock('$app/env/private');
	});

	it('hashIp throws', async () => {
		vi.resetModules();
		vi.doMock('$app/env/private', () => ({ ADMIN_SECRET: 'x', IP_HASH_SECRET: '' }));
		const mod = await import('./ip.js');
		expect(() => mod.hashIp('1.2.3.4')).toThrow(/IP_HASH_SECRET/);
	});
});

describe('isCloudflareIp', () => {
	it('matches the published ranges at their edges, and nothing else', () => {
		expect(isCloudflareIp('104.16.0.0')).toBe(true);
		expect(isCloudflareIp('104.23.255.255')).toBe(true);
		expect(isCloudflareIp('104.24.0.0')).toBe(true);
		expect(isCloudflareIp('104.28.0.0')).toBe(false);
		expect(isCloudflareIp('162.159.255.255')).toBe(true);
		expect(isCloudflareIp('162.160.0.0')).toBe(false);
		expect(isCloudflareIp('2606:4700::6810:84e5')).toBe(true);
		expect(isCloudflareIp('2606:4701::1')).toBe(false);
		expect(isCloudflareIp('2a06:98c7:ffff::1')).toBe(true);
		expect(isCloudflareIp('2a06:98c8::1')).toBe(false);
	});

	it('rejects malformed addresses', () => {
		for (const ip of [
			'',
			'104.16.0',
			'104.16.0.256',
			'2606:4700:::1',
			'not-an-ip',
			'1:2:3:4:5:6:7:8:9'
		]) {
			expect(isCloudflareIp(ip)).toBe(false);
		}
	});
});

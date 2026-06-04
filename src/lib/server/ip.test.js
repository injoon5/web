import { describe, it, expect, vi, afterEach } from 'vitest';
import { getClientIp, hashIp, requestIpHash } from './ip';

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
	it('hashes the resolved client IP', () => {
		const req = reqWith({ 'x-real-ip': '203.0.113.5' });
		expect(requestIpHash(req)).toBe(hashIp('203.0.113.5'));
	});
});

describe('when IP_HASH_SECRET is not configured', () => {
	afterEach(() => {
		vi.resetModules();
		vi.doUnmock('$env/static/private');
	});

	it('hashIp throws', async () => {
		vi.resetModules();
		vi.doMock('$env/static/private', () => ({ ADMIN_SECRET: 'x', IP_HASH_SECRET: '' }));
		const mod = await import('./ip');
		expect(() => mod.hashIp('1.2.3.4')).toThrow(/IP_HASH_SECRET/);
	});
});

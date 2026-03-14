import { describe, it, expect } from 'vitest';
import { getClientIp, hashIp } from './ip.js';

describe('getClientIp', () => {
	it('returns the first IP from x-forwarded-for header', () => {
		const req = new Request('http://localhost', {
			headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1, 172.16.0.1' }
		});
		expect(getClientIp(req)).toBe('203.0.113.1');
	});

	it('trims whitespace from x-forwarded-for', () => {
		const req = new Request('http://localhost', {
			headers: { 'x-forwarded-for': '  203.0.113.5  , 10.0.0.2' }
		});
		expect(getClientIp(req)).toBe('203.0.113.5');
	});

	it('returns x-real-ip when x-forwarded-for is absent', () => {
		const req = new Request('http://localhost', {
			headers: { 'x-real-ip': '198.51.100.7' }
		});
		expect(getClientIp(req)).toBe('198.51.100.7');
	});

	it('falls back to 127.0.0.1 when no IP headers are present', () => {
		const req = new Request('http://localhost');
		expect(getClientIp(req)).toBe('127.0.0.1');
	});

	it('prefers x-forwarded-for over x-real-ip', () => {
		const req = new Request('http://localhost', {
			headers: {
				'x-forwarded-for': '203.0.113.10',
				'x-real-ip': '198.51.100.7'
			}
		});
		expect(getClientIp(req)).toBe('203.0.113.10');
	});
});

describe('hashIp', () => {
	it('returns a 64-character hex string (SHA-256)', () => {
		const hash = hashIp('127.0.0.1');
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('produces consistent output for the same input', () => {
		expect(hashIp('10.0.0.1')).toBe(hashIp('10.0.0.1'));
	});

	it('produces different hashes for different IPs', () => {
		expect(hashIp('1.1.1.1')).not.toBe(hashIp('1.1.1.2'));
	});

	it('produces the known SHA-256 hash for 127.0.0.1', () => {
		// echo -n "127.0.0.1" | sha256sum
		expect(hashIp('127.0.0.1')).toBe(
			'12ca17b49af2289436f303e0166030a21e525d266e209267433801a8fd4071a0'
		);
	});
});

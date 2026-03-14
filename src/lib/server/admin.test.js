import { describe, it, expect, vi } from 'vitest';

// Mock the env module before importing admin.ts
vi.mock('$env/static/private', () => ({
	ADMIN_SECRET: 'super-secret-value'
}));

const { verifyAdminSecret } = await import('./admin.js');

describe('verifyAdminSecret', () => {
	it('returns true when x-admin-secret matches ADMIN_SECRET', () => {
		const req = new Request('http://localhost', {
			headers: { 'x-admin-secret': 'super-secret-value' }
		});
		expect(verifyAdminSecret(req)).toBe(true);
	});

	it('returns false when x-admin-secret does not match', () => {
		const req = new Request('http://localhost', {
			headers: { 'x-admin-secret': 'wrong-secret' }
		});
		expect(verifyAdminSecret(req)).toBe(false);
	});

	it('returns false when x-admin-secret header is missing', () => {
		const req = new Request('http://localhost');
		expect(verifyAdminSecret(req)).toBe(false);
	});

	it('returns false when x-admin-secret is an empty string', () => {
		const req = new Request('http://localhost', {
			headers: { 'x-admin-secret': '' }
		});
		expect(verifyAdminSecret(req)).toBe(false);
	});

	it('is case-sensitive', () => {
		const req = new Request('http://localhost', {
			headers: { 'x-admin-secret': 'Super-Secret-Value' }
		});
		expect(verifyAdminSecret(req)).toBe(false);
	});
});

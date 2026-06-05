import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { ADMIN_SECRET } from '$env/static/private';
import {
	secretsMatch,
	createAdminSessionToken,
	verifyAdminSessionToken,
	verifyAdminSecret,
	verifyAdminCookie,
	requireAdmin,
	SESSION_MAX_AGE_MS
} from './admin';

/** Build a token signed with the (known) test secret and a chosen expiry. */
function signToken(expiresAt, nonce = 'deadbeef') {
	const payload = `${expiresAt}.${nonce}`;
	const sig = createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
	return `${payload}.${sig}`;
}

describe('secretsMatch', () => {
	it('matches the configured secret and rejects others', () => {
		expect(secretsMatch(ADMIN_SECRET)).toBe(true);
		expect(secretsMatch('wrong')).toBe(false);
		expect(secretsMatch('')).toBe(false);
	});
});

describe('session token round-trip', () => {
	it('issues a 3-part token that verifies', () => {
		const token = createAdminSessionToken();
		expect(token.split('.')).toHaveLength(3);
		expect(verifyAdminSessionToken(token)).toBe(true);
	});

	it('rejects a token with a tampered signature', () => {
		const token = createAdminSessionToken();
		const parts = token.split('.');
		parts[2] = parts[2].replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
		expect(verifyAdminSessionToken(parts.join('.'))).toBe(false);
	});

	it('rejects a token whose payload was changed (signature no longer matches)', () => {
		const token = createAdminSessionToken();
		const [, nonce, sig] = token.split('.');
		const forgedExpiry = Date.now() + SESSION_MAX_AGE_MS * 2;
		expect(verifyAdminSessionToken(`${forgedExpiry}.${nonce}.${sig}`)).toBe(false);
	});

	it('rejects an expired token even with a valid signature', () => {
		expect(verifyAdminSessionToken(signToken(Date.now() - 1000))).toBe(false);
	});

	it('accepts a future, validly-signed token', () => {
		expect(verifyAdminSessionToken(signToken(Date.now() + 60_000))).toBe(true);
	});

	it('rejects malformed / empty tokens', () => {
		expect(verifyAdminSessionToken('')).toBe(false);
		expect(verifyAdminSessionToken('a.b')).toBe(false);
		expect(verifyAdminSessionToken('a.b.c.d')).toBe(false);
		expect(verifyAdminSessionToken('notanumber.nonce.sig')).toBe(false);
	});

	it('rejects a non-hex signature without throwing', () => {
		expect(verifyAdminSessionToken(`${Date.now() + 60_000}.nonce.zzzz`)).toBe(false);
	});
});

describe('verifyAdminSecret', () => {
	it('accepts a correct x-admin-secret header', () => {
		const req = new Request('http://x/api', { headers: { 'x-admin-secret': ADMIN_SECRET } });
		expect(verifyAdminSecret(req)).toBe(true);
	});

	it('rejects a wrong x-admin-secret header', () => {
		const req = new Request('http://x/api', { headers: { 'x-admin-secret': 'nope' } });
		expect(verifyAdminSecret(req)).toBe(false);
	});

	it('falls back to a valid admin_token cookie', () => {
		const token = createAdminSessionToken();
		const req = new Request('http://x/api', {
			headers: { cookie: `other=1; admin_token=${token}` }
		});
		expect(verifyAdminSecret(req)).toBe(true);
	});

	it('rejects when neither header nor cookie is present', () => {
		expect(verifyAdminSecret(new Request('http://x/api'))).toBe(false);
	});
});

describe('verifyAdminCookie', () => {
	it('validates the token and rejects undefined', () => {
		expect(verifyAdminCookie(createAdminSessionToken())).toBe(true);
		expect(verifyAdminCookie(undefined)).toBe(false);
		expect(verifyAdminCookie('')).toBe(false);
	});
});

describe('requireAdmin', () => {
	it('throws a 401 for non-admin requests', () => {
		try {
			requireAdmin(new Request('http://x/api'));
			throw new Error('expected requireAdmin to throw');
		} catch (err) {
			expect(err.status).toBe(401);
		}
	});

	it('does not throw for an authenticated request', () => {
		const req = new Request('http://x/api', { headers: { 'x-admin-secret': ADMIN_SECRET } });
		expect(() => requireAdmin(req)).not.toThrow();
	});
});

describe('when ADMIN_SECRET is not configured', () => {
	afterEach(() => {
		vi.resetModules();
		vi.doUnmock('$env/static/private');
	});

	it('secretsMatch returns false and createAdminSessionToken throws', async () => {
		vi.resetModules();
		vi.doMock('$env/static/private', () => ({ ADMIN_SECRET: '', IP_HASH_SECRET: 'x' }));
		const mod = await import('./admin');
		expect(mod.secretsMatch('anything')).toBe(false);
		expect(() => mod.createAdminSessionToken()).toThrow();
	});
});

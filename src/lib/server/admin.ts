import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { ADMIN_SECRET } from '$env/static/private';

/** Must stay in sync with convex/lib/secrets.js (Convex V8 crypto.subtle). */

const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 1000;

export function secretsMatch(candidate: string): boolean {
	if (!ADMIN_SECRET) return false;
	const a = createHmac('sha256', ADMIN_SECRET).update(candidate).digest();
	const b = createHmac('sha256', ADMIN_SECRET).update(ADMIN_SECRET).digest();
	return timingSafeEqual(a, b);
}

export function createAdminSessionToken(): string {
	if (!ADMIN_SECRET) throw new Error('ADMIN_SECRET is not configured');
	const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
	const nonce = randomBytes(16).toString('hex');
	const payload = `${expiresAt}.${nonce}`;
	const sig = createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
	return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string): boolean {
	if (!ADMIN_SECRET || !token) return false;

	const parts = token.split('.');
	if (parts.length !== 3) return false;

	const [expiresRaw, nonce, sig] = parts;
	const expiresAt = Number(expiresRaw);
	if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
	if (!nonce || !sig) return false;

	const payload = `${expiresRaw}.${nonce}`;
	const expected = createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');

	try {
		return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
	} catch {
		return false;
	}
}

export function verifyAdminSecret(request: Request): boolean {
	const header = request.headers.get('x-admin-secret');
	if (header) return secretsMatch(header);

	const cookie = request.headers.get('cookie') ?? '';
	const match = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
	if (match) return verifyAdminSessionToken(decodeURIComponent(match[1]));

	return false;
}

export function verifyAdminCookie(token: string | undefined): boolean {
	return !!token && verifyAdminSessionToken(token);
}

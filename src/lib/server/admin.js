// @ts-check
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { dev } from '$app/env';
import { ADMIN_SECRET } from '$app/env/private';
import { ADMIN_HINT_COOKIE, ADMIN_TOKEN_COOKIE, readCookie } from '#lib/cookies.js';

export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 1000;

// HMAC(secret, secret) is constant per process — compute it once, lazily so an
// unconfigured secret doesn't throw at import time.
/** @type {Buffer | null} */
let selfDigest = null;

/**
 * @param {string} candidate
 * @returns {boolean}
 */
export function secretsMatch(candidate) {
	if (!ADMIN_SECRET) return false;
	const a = createHmac('sha256', ADMIN_SECRET).update(candidate).digest();
	selfDigest ??= createHmac('sha256', ADMIN_SECRET).update(ADMIN_SECRET).digest();
	return timingSafeEqual(a, selfDigest);
}

/** @returns {string} */
export function createAdminSessionToken() {
	if (!ADMIN_SECRET) throw new Error('ADMIN_SECRET is not configured');
	const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
	const nonce = randomBytes(16).toString('hex');
	const payload = `${expiresAt}.${nonce}`;
	const sig = createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
	return `${payload}.${sig}`;
}

/**
 * @param {string} token
 * @returns {boolean}
 */
export function verifyAdminSessionToken(token) {
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

/**
 * The expiry stamped into a valid session token, or null if the token does not
 * verify. `/admin`'s load hands this to Convex so the session row can be
 * scheduled for deletion at the same moment the cookie stops being accepted
 * here — the two deadlines are the same number, read off the same token.
 *
 * @param {string} token
 * @returns {number | null}
 */
export function sessionTokenExpiry(token) {
	if (!verifyAdminSessionToken(token)) return null;
	const expiresAt = Number(token.split('.')[0]);
	return Number.isFinite(expiresAt) ? expiresAt : null;
}

/**
 * @param {Request} request
 * @returns {boolean}
 */
export function verifyAdminSecret(request) {
	const header = request.headers.get('x-admin-secret');
	if (header) return secretsMatch(header);

	const token = readCookie(request.headers.get('cookie') ?? '', ADMIN_TOKEN_COOKIE);
	return token !== null && verifyAdminSessionToken(token);
}

/**
 * Sign the admin in: the session token, and beside it the hint that grants
 * nothing — `/api/admin/whoami` still checks the real cookie — but tells pages
 * like /now that asking is worth a request, so ordinary visitors don't call a
 * function on every view. Both live exactly as long as the token does.
 *
 * @param {import('@sveltejs/kit').Cookies} cookies
 */
export function setAdminCookies(cookies) {
	const options = /** @type {const} */ ({
		path: '/',
		sameSite: 'strict',
		secure: !dev,
		maxAge: SESSION_MAX_AGE_MS / 1000
	});
	cookies.set(ADMIN_TOKEN_COOKIE, createAdminSessionToken(), { ...options, httpOnly: true });
	cookies.set(ADMIN_HINT_COOKIE, '1', { ...options, httpOnly: false });
}

/**
 * Sign the admin out, returning the token the cookie held ('' for none).
 *
 * @param {import('@sveltejs/kit').Cookies} cookies
 */
export function clearAdminCookies(cookies) {
	const token = cookies.get(ADMIN_TOKEN_COOKIE) ?? '';
	cookies.delete(ADMIN_TOKEN_COOKIE, { path: '/' });
	cookies.delete(ADMIN_HINT_COOKIE, { path: '/' });
	return token;
}

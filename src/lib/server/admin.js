// @ts-check
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { error } from '@sveltejs/kit';
import { ADMIN_SECRET } from '$env/static/private';

/** Must stay in sync with convex/lib/secrets.js (Convex V8 crypto.subtle). */

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

	const cookie = request.headers.get('cookie') ?? '';
	const match = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
	if (match) {
		try {
			return verifyAdminSessionToken(decodeURIComponent(match[1]));
		} catch {
			// A malformed percent-encoding throws URIError; treat it as no token.
			return false;
		}
	}

	return false;
}

/**
 * @param {string | undefined} token
 * @returns {boolean}
 */
export function verifyAdminCookie(token) {
	return !!token && verifyAdminSessionToken(token);
}

/**
 * Throw a 401 SvelteKit error if the request is not from an admin.
 * @param {Request} request
 */
export function requireAdmin(request) {
	if (!verifyAdminSecret(request)) throw error(401, 'Unauthorized');
}

// @ts-check
/** Every cookie the site sets, by the name the server and the browser both read. */

/** The admin session: httpOnly, signed, 24h (`#lib/server/admin.js`). */
export const ADMIN_TOKEN_COOKIE = 'admin_token';
/** Readable beside it, granting nothing: tells a page that asking `/api/admin/whoami` is worth it. */
export const ADMIN_HINT_COOKIE = 'admin_hint';
/** The language a visitor last picked; vercel.json redirects on it too. */
export const LANG_COOKIE = 'preferred-lang';

/**
 * One cookie's value out of a `Cookie` header or `document.cookie`, or null.
 *
 * @param {string} cookies
 * @param {string} name
 */
export function readCookie(cookies, name) {
	for (const part of cookies.split(';')) {
		const [key, ...value] = part.trim().split('=');
		if (key !== name) continue;
		try {
			return decodeURIComponent(value.join('='));
		} catch {
			return null;
		}
	}
	return null;
}

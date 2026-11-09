// @ts-check
import { browser } from '$app/env';
/** Every cookie the site sets, by the name the server and the browser both read. */

/** The admin session: httpOnly, signed, 24h (`#lib/server/admin.js`). */
export const ADMIN_TOKEN_COOKIE = 'admin_token';
/** Readable beside it, granting nothing: tells a page that asking `/api/admin/whoami` is worth it. */
export const ADMIN_HINT_COOKIE = 'admin_hint';
/**
 * The language a visitor last picked. The language is the URL
 * (`#lib/content/article-paths.js`); this only remembers the choice, so that
 * vercel.json can send a direct visit to `/en` and the article load can do the
 * same for a link followed inside the site.
 */
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

/** The language the visitor last picked, or null. Browser only. */
export function cookieLang() {
	return browser ? readCookie(document.cookie, LANG_COOKIE) : null;
}

/** @param {string} lang */
export function persistLang(lang) {
	try {
		document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
	} catch {
		// Cookies may be unavailable.
	}
}

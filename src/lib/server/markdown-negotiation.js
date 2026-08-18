// @ts-check
import { CONTENT_SIGNAL } from './content-signals.js';

/** Same policy as `CONTENT_CACHE_CONTROL` in content.js — listings and articles. */
const MARKDOWN_CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

/**
 * @typedef {{ type: string, q: number }} AcceptType
 */

/**
 * Split an Accept header into type/q pairs. Missing q defaults to 1, per RFC 9110.
 *
 * @param {string} header
 * @returns {AcceptType[]}
 */
export function parseAccept(header) {
	if (!header) return [];
	/** @type {AcceptType[]} */
	const out = [];
	for (const part of header.split(',')) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		const [rawType, ...params] = trimmed.split(';');
		const type = (rawType ?? '').trim().toLowerCase();
		if (!type) continue;
		let q = 1;
		for (const param of params) {
			const eq = param.indexOf('=');
			if (eq === -1) continue;
			const key = param.slice(0, eq).trim();
			if (key !== 'q') continue;
			const n = Number(param.slice(eq + 1).trim());
			q = Number.isFinite(n) ? n : 0;
		}
		out.push({ type, q });
	}
	return out;
}

/**
 * Exact-type quality, or null if the type was not listed. A star-star catch-all
 * is ignored — browsers send it, and treating it as markdown would hijack every
 * page.
 *
 * @param {AcceptType[]} parsed
 * @param {string} type
 * @returns {number | null}
 */
function quality(parsed, type) {
	let found = null;
	for (const entry of parsed) {
		if (entry.type === type) found = entry.q;
	}
	return found;
}

/**
 * True when the client explicitly prefers markdown over HTML. A listed
 * `text/markdown` at equal q to `text/html` wins — that's an agent naming the
 * type, not a browser.
 *
 * @param {string | null | undefined} acceptHeader
 */
export function prefersMarkdown(acceptHeader) {
	const parsed = parseAccept(acceptHeader ?? '');
	const markdown = Math.max(
		quality(parsed, 'text/markdown') ?? -1,
		quality(parsed, 'text/x-markdown') ?? -1
	);
	if (markdown <= 0) return false;
	const html = quality(parsed, 'text/html') ?? 0;
	return markdown >= html;
}

/**
 * Paths that are documents an agent might read. APIs, hashed assets, the admin
 * wall, and anything with a file extension (rss.xml, robots.txt, images) stay
 * in their native type.
 *
 * @param {string} pathname
 */
export function isMarkdownNegotiable(pathname) {
	const path = normalizePathname(pathname);
	if (path.startsWith('/api/')) return false;
	if (path.startsWith('/_app/')) return false;
	if (path.startsWith('/admin')) return false;
	if (/\.[a-z0-9]+$/i.test(path)) return false;
	return true;
}

/**
 * Strip a trailing slash (except `/`) so `/blog` and `/blog/` resolve the same.
 *
 * @param {string} pathname
 */
export function normalizePathname(pathname) {
	const path = pathname.split('?')[0] || '/';
	if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
	return path || '/';
}

/**
 * GPT-style 4 chars/token estimate. Cloudflare publishes the same header off a
 * real tokenizer; this is close enough for context-window budgeting.
 *
 * @param {string} text
 */
export function estimateTokens(text) {
	return Math.ceil(text.length / 4);
}

/**
 * @param {string} body
 * @param {{ status?: number }} [opts]
 */
export function markdownResponse(body, opts = {}) {
	return new Response(body, {
		status: opts.status ?? 200,
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			Vary: 'Accept',
			'Cache-Control': MARKDOWN_CACHE_CONTROL,
			'x-markdown-tokens': String(estimateTokens(body)),
			'Content-Signal': CONTENT_SIGNAL
		}
	});
}

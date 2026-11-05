// @ts-check
import { Marked } from 'marked';

/**
 * The /now page's markdown, rendered the same way on the server (ISR) and in
 * the browser (after an edit), so the two can never disagree about markup.
 *
 * It replaced marked + DOMPurify in the browser. Markdown only produces markup
 * of its own, so the only ways in for script are raw HTML and URLs, and both
 * are closed here instead of cleaned up afterwards: raw HTML is shown as text,
 * and a link or image keeps its URL only if it is http(s), mailto, or on this
 * site. The content is admin-authored — `now.update` checks ADMIN_SECRET — so
 * this is the second line, not the first.
 */

/** @param {string} s */
const escapeHtml = (s) =>
	s.replace(
		/[&<>"']/g,
		(c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": '#39' }[c]};`
	);

/** @param {string | null | undefined} url */
export function safeUrl(url) {
	if (!url) return null;
	const trimmed = url.trim();
	if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
	if (/^\/(?!\/)/.test(trimmed) || trimmed.startsWith('#')) return trimmed;
	return null;
}

const marked = new Marked({
	gfm: true,
	breaks: false,
	async: false,
	renderer: {
		html({ text }) {
			return escapeHtml(text);
		},
		link({ href, title, tokens }) {
			const inner = this.parser.parseInline(tokens);
			const url = safeUrl(href);
			if (!url) return inner;
			const t = title ? ` title="${escapeHtml(title)}"` : '';
			return `<a href="${escapeHtml(url)}"${t}>${inner}</a>`;
		},
		image({ href, title, text }) {
			const url = safeUrl(href);
			if (!url) return escapeHtml(text);
			const t = title ? ` title="${escapeHtml(title)}"` : '';
			return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}"${t} loading="lazy">`;
		}
	}
});

/** @param {string | null | undefined} markdown */
export function renderNow(markdown) {
	return markdown ? /** @type {string} */ (marked.parse(markdown)) : '';
}

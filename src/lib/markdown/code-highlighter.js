import { codeToTokens, isSupportedLanguage } from '@pierre/highlights';
import { pierreDark, pierreLight } from '@pierre/highlights/themes';

/**
 * mdsvex highlighter backed by `@pierre/highlights`.
 *
 * Both themes are emitted as custom properties (`--code-light`, `--code-dark`)
 * on every token and `app.css` picks one off the `.dark` class `app.html` sets,
 * so switching theme repaints without re-highlighting and SSR stays identical.
 *
 * The fence meta that the posts use is parsed here: `{1,3-5}` highlights lines,
 * `title="…"` and `caption="…"` frame the block, `showLineNumbers` numbers it.
 */

const themes = { light: pierreLight, dark: pierreDark };
const cssVariablePrefix = '--code-';

/** @type {Record<string, string>} */
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** @type {Record<string, string>} */
const SVELTE_ESCAPES = { '{': '&#123;', '}': '&#125;', '`': '&#96;' };

/**
 * Escape for HTML, then escape curlies and backticks so the markup survives
 * `{@html ...}` in a `.svelte` module.
 *
 * @see https://github.com/pngwn/MDsveX/blob/main/packages/mdsvex/src/transformers/index.ts
 * @param {string} str
 * @returns {string}
 */
const escape = (str) =>
	str
		.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c])
		.replace(/[{}`]/g, (c) => SVELTE_ESCAPES[c])
		.replace(/\\([trn])/g, '&#92;$1');

/**
 * @param {Record<string, string | number> | undefined} style
 * @returns {string}
 */
const styleAttr = (style) =>
	style
		? ` style="${escape(
				Object.entries(style)
					.map(([k, v]) => `${k}:${v}`)
					.join(';')
			)}"`
		: '';

/**
 * @param {string | null} meta
 * @returns {{ highlighted: Set<number>, title?: string, caption?: string, lineNumbers: boolean }}
 */
export function parseMeta(meta) {
	const text = meta ?? '';
	/** @type {Set<number>} */
	const highlighted = new Set();
	for (const range of text.match(/\{([\d,\s-]+)\}/)?.[1].split(',') ?? []) {
		const [from, to = from] = range.split('-').map((n) => Number.parseInt(n, 10));
		for (let line = from; line <= to; line++) highlighted.add(line);
	}

	/** @param {string} key */
	const quoted = (key) =>
		text
			.match(new RegExp(`\\b${key}=(?:"([^"]*)"|'([^']*)')`))
			?.slice(1)
			.find((v) => v != null);

	return {
		highlighted,
		title: quoted('title'),
		caption: quoted('caption'),
		lineNumbers: /\bshowLineNumbers\b/.test(text)
	};
}

/**
 * mdsvex's `highlight.highlighter`. Highlights is synchronous after import, and
 * mdsvex accepts a plain return as well as a promise.
 *
 * @param {string} code
 * @param {string | null} lang
 * @param {string | null} meta
 * @returns {string}
 */
export function highlight(code, lang, meta) {
	const { highlighted, title, caption, lineNumbers } = parseMeta(meta);
	const result = codeToTokens(code, {
		lang: lang && isSupportedLanguage(lang) ? lang : 'plain',
		themes,
		defaultColor: false,
		cssVariablePrefix
	});

	const tokens = code.endsWith('\n') ? result.tokens.slice(0, -1) : result.tokens;
	const lines = tokens.map((line, i) => {
		const attrs = highlighted.has(i + 1)
			? ' data-line="" data-highlighted-line=""'
			: ' data-line=""';
		// An empty grid item has no height; a space keeps the blank line.
		const body = line.length
			? line.map((t) => `<span${styleAttr(t.htmlStyle)}>${escape(t.content)}</span>`).join('')
			: ' ';
		return `<span${attrs}>${body}</span>`;
	});

	const language = lang ? ` data-language="${escape(lang)}"` : '';
	const numbers = lineNumbers
		? ` data-line-numbers="" data-line-numbers-max-digits="${String(lines.length).length}"`
		: '';

	return [
		'<figure data-code-figure="">',
		title == null ? '' : `<div data-code-title="">${escape(title)}</div>`,
		`<pre${language}${result.rootStyle ? ` style="${escape(result.rootStyle)}"` : ''}>`,
		`<code${language}${numbers}>${lines.join('\n')}</code></pre>`,
		caption == null ? '' : `<figcaption data-code-caption="">${escape(caption)}</figcaption>`,
		'</figure>'
	].join('');
}

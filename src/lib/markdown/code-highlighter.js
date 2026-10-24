import { codeToTokens, isSupportedLanguage } from '@pierre/highlights';
import { cssVariables } from '@pierre/highlights/themes';
import { CODE_VAR_PREFIX, FOREGROUND, TOKEN_CLASS } from './code-theme.js';

/**
 * mdsvex highlighter backed by `@pierre/highlights`.
 *
 * Tokens come back naming their syntax category (`var(--code-keyword)`), and
 * each becomes a short class for its light/dark colour pair, which
 * `code-theme.css` defines under both themes off the `.dark` class `app.html`
 * sets. Switching theme repaints without re-highlighting, SSR stays identical,
 * and a token costs a few bytes rather than a colour per theme.
 * `remarkStylesheets` imports the palette.
 *
 * The fence meta that the posts use is parsed here: `{1,3-5}` highlights lines,
 * `title="…"` and `caption="…"` frame the block, `showLineNumbers` numbers it.
 */

/** @type {Record<string, string>} */
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** @type {Record<string, string>} */
const SVELTE_ESCAPES = { '{': '&#123;', '}': '&#125;', '`': '&#96;' };

/**
 * Escape for HTML, then escape curlies and backticks: mdsvex inlines the result
 * into the compiled file as Svelte template source, where `{` opens an
 * expression.
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
 * @param {string | undefined} color a token's `var(--code-*)`
 * @returns {string} its opening attributes, empty for the inherited foreground
 */
function tokenAttrs(color) {
	if (!color || color === FOREGROUND) return '';
	const cls = TOKEN_CLASS.get(color);
	// A category the theme does not define still renders, just less compactly.
	return cls ? ` class="${cls}"` : ` style="color:${escape(color)}"`;
}

/**
 * Adjacent tokens of one colour as one span; the lexer splits on boundaries the
 * palette does not distinguish.
 *
 * @param {import('@pierre/highlights').ThemedToken[]} line
 * @returns {string}
 */
function renderLine(line) {
	/** @type {{ attrs: string, content: string }[]} */
	const runs = [];
	for (const { color, content } of line) {
		const attrs = tokenAttrs(color);
		const last = runs.at(-1);
		if (last && last.attrs === attrs) last.content += content;
		else runs.push({ attrs, content });
	}
	return runs
		.map(({ attrs, content }) =>
			attrs ? `<span${attrs}>${escape(content)}</span>` : escape(content)
		)
		.join('');
}

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
		theme: cssVariables,
		cssVariablePrefix: CODE_VAR_PREFIX
	});

	const tokens = code.endsWith('\n') ? result.tokens.slice(0, -1) : result.tokens;
	const lines = tokens.map((line, i) => {
		const attrs = highlighted.has(i + 1)
			? ' data-line="" data-highlighted-line=""'
			: ' data-line=""';
		// The lines are grid items, so the newlines between them are not what a
		// copy carries: an empty item copies as nothing and a blank line is lost,
		// and a space would ride along as trailing whitespace. A newline of its
		// own copies back exactly and keeps the line's height.
		const body = line.length ? renderLine(line) : '\n';
		return `<span${attrs}>${body}</span>`;
	});

	const language = lang ? ` data-language="${escape(lang)}"` : '';
	const numbers = lineNumbers
		? ` data-line-numbers="" data-line-numbers-max-digits="${String(lines.length).length}"`
		: '';

	return [
		'<figure data-code-figure="">',
		title == null ? '' : `<div data-code-title="">${escape(title)}</div>`,
		// The <pre> is the scroller, and Safari does not make a scroller focusable
		// on its own; without a tab stop a wide block cannot be read by keyboard.
		'<!-- svelte-ignore a11y_no_noninteractive_tabindex -->',
		`<pre${language} tabindex="0">`,
		`<code${language}${numbers}>${lines.join('\n')}</code></pre>`,
		caption == null ? '' : `<figcaption data-code-caption="">${escape(caption)}</figcaption>`,
		'</figure>'
	].join('');
}

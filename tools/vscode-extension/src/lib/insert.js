'use strict';

const { scanMarkdown } = require('./markdown-scan');

/**
 * What gets typed into the document when media lands in it.
 *
 * Images go one per line with no blank line between them, because that is
 * exactly what `remark-gallery` reads as a group: consecutive image lines are
 * one paragraph in mdast, so dropping four screenshots produces a `<Gallery />`
 * and dropping one produces a figure. The escape hatch is the same as it is for
 * a human author — put a blank line in.
 */

/** @param {string} value */
function escapeSnippet(value) {
	return String(value).replace(/[\\$}]/g, '\\$&');
}

/**
 * A URL safe to sit inside `![]()`. Spaces and parentheses are the two things
 * that break the link; everything else stays readable, including Hangul.
 *
 * @param {string} url
 */
function encodeUrl(url) {
	const escapes = { ' ': '%20', '(': '%28', ')': '%29' };
	return url.replace(/[ ()]/g, (char) => escapes[char]);
}

/**
 * @typedef {Object} MediaEntry
 * @property {'image' | 'video'} media
 * @property {string} url        site-absolute, e.g. `/images/uploads/us-camp/gate.jpeg`
 * @property {string} [alt]
 */

/**
 * @param {MediaEntry[]} entries
 * @param {{ altPlaceholder?: boolean, componentName?: string }} [options]
 * @returns {string}  a snippet body, with tab stops when placeholders are on
 */
function buildMediaSnippet(entries, options = {}) {
	const placeholder = options.altPlaceholder !== false;
	const component = options.componentName ?? 'LazyVideo';

	let stop = 0;
	const images = [];
	const videos = [];

	for (const entry of entries) {
		const url = escapeSnippet(encodeUrl(entry.url));

		if (entry.media === 'video') {
			const label = entry.alt
				? escapeSnippet(entry.alt)
				: placeholder
					? `\${${(stop += 1)}:Play demo video}`
					: 'Play demo video';
			videos.push(`<${component} src="${url}" label="${label}" />`);
			continue;
		}

		const alt = entry.alt ? escapeSnippet(entry.alt) : placeholder ? `\${${(stop += 1)}:alt}` : '';
		images.push(`![${alt}](${url})`);
	}

	const blocks = [];
	if (images.length) blocks.push(images.join('\n'));
	if (videos.length) blocks.push(videos.join('\n\n'));

	const body = blocks.join('\n\n');
	return placeholder && stop > 0 ? `${body}$0` : body;
}

/**
 * Where the media snippet should start, so it never lands mid-sentence.
 *
 * @param {string} text
 * @param {number} offset
 */
function blockInsertPadding(text, offset) {
	const before = text.slice(Math.max(0, offset - 2), offset);
	const after = text.slice(offset, offset + 2);

	const atLineStart = offset === 0 || before.endsWith('\n');
	const prefix = atLineStart ? (before.endsWith('\n\n') || offset === 0 ? '' : '\n') : '\n\n';
	const suffix =
		after.startsWith('\n\n') || offset >= text.length ? '' : after.startsWith('\n') ? '\n' : '\n\n';

	return { prefix, suffix };
}

/**
 * The edit that makes `<LazyVideo />` resolve: an import in the file's instance
 * `<script>`, or a whole `<script>` block just under the frontmatter if there
 * isn't one. mdsvex performs this same splice for its own layout import.
 *
 * @param {string} text
 * @param {{ name: string, path: string }} component
 * @returns {{ offset: number, insert: string } | null}
 */
function componentImportEdit(text, component) {
	const line = `import ${component.name} from '${component.path}';`;
	if (text.includes(line)) return null;

	const scan = scanMarkdown(text);
	if (new RegExp(`\\bimport\\s+${component.name}\\b`).test(text)) return null;

	if (scan.script) {
		return { offset: scan.script.openEnd, insert: `\n\t${line}` };
	}

	const at = scan.frontmatter ? scan.frontmatter.end : 0;
	const lead = scan.frontmatter ? '\n\n' : '';
	return { offset: at, insert: `${lead}<script>\n\t${line}\n</script>\n` };
}

/**
 * Wrap a run of lines in an explicit gallery fence. The explicit form groups
 * however the images are spaced, including a single one.
 *
 * @param {string} selection
 */
function galleryFence(selection) {
	const body = selection.replace(/^\n+|\n+$/g, '');
	return `:::gallery\n${body}\n:::`;
}

module.exports = {
	blockInsertPadding,
	buildMediaSnippet,
	componentImportEdit,
	encodeUrl,
	escapeSnippet,
	galleryFence
};

'use strict';

/**
 * One pass over an mdsvex document, producing everything the providers need to
 * ask questions about it: where the frontmatter is, which images and `src=`
 * attributes it references, whether its `:::gallery` fences close, where the
 * instance `<script>` is, and which `{...}` expressions Svelte will compile.
 *
 * Everything is reported as offsets, and everything inside code — fenced,
 * inline, or an HTML comment — is skipped. A fenced example of markdown is not
 * a broken link.
 */

const FENCE_OPEN = /^\s{0,3}(`{3,}|~{3,})/;
const GALLERY_OPEN = /^:::\s*gallery\s*$/;
const GALLERY_CLOSE = /^:::\s*$/;
const IMAGE = /!\[([^\]\n]*)\]\(\s*(<[^>\n]*>|[^)\s]+)(?:\s+["'][^"'\n]*["'])?\s*\)/g;
const ATTR_URL = /\b(?:src|poster)\s*=\s*["'](\/[^"'\n]*)["']/g;
const INSTANCE_SCRIPT = /<script(?![^>]*\bmodule\b)(?![^>]*context\s*=)[^>]*>/i;

/** @param {string} text */
function lineOffsets(text) {
	const starts = [0];
	for (let i = 0; i < text.length; i += 1) {
		if (text[i] === '\n') starts.push(i + 1);
	}
	return starts;
}

/**
 * @param {Uint8Array} mask
 * @param {number} start
 * @param {number} end
 */
function mark(mask, start, end) {
	for (let i = Math.max(0, start); i < Math.min(mask.length, end); i += 1) mask[i] = 1;
}

/**
 * @typedef {Object} ScannedImage
 * @property {number} index      offset of `!`
 * @property {number} length
 * @property {string} alt
 * @property {number} altIndex
 * @property {string} url
 * @property {number} urlIndex
 *
 * @typedef {Object} ScannedFence
 * @property {number} index      offset of the opening `:::`
 * @property {number} line
 * @property {number | null} closeIndex
 *
 * @typedef {Object} ScanResult
 * @property {{ start: number, end: number, body: string } | null} frontmatter
 * @property {{ openStart: number, openEnd: number, close: number | null } | null} script
 * @property {ScannedImage[]} images
 * @property {{ url: string, index: number }[]} attrUrls
 * @property {ScannedFence[]} galleryFences
 * @property {{ index: number, text: string }[]} braceSpans
 * @property {Uint8Array} protectedMask
 */

/**
 * @param {string} text
 * @returns {ScanResult}
 */
function scanMarkdown(text) {
	const mask = new Uint8Array(text.length);
	const starts = lineOffsets(text);

	/** @type {ScanResult['frontmatter']} */
	let frontmatter = null;
	let firstBodyLine = 0;

	if (/^---\r?\n/.test(text)) {
		for (let i = 1; i < starts.length; i += 1) {
			const line = text.slice(starts[i]).split('\n', 1)[0].trimEnd();
			if (line === '---') {
				const end = starts[i] + line.length;
				frontmatter = { start: 0, end, body: text.slice(starts[1], starts[i]) };
				mark(mask, 0, end);
				firstBodyLine = i + 1;
				break;
			}
		}
	}

	/** @type {ScannedFence[]} */
	const galleryFences = [];
	/** @type {number[]} */
	const openGalleries = [];

	let fenceMarker = '';

	for (let i = firstBodyLine; i < starts.length; i += 1) {
		const start = starts[i];
		const raw = text.slice(start, starts[i + 1] ?? text.length);
		const line = raw.replace(/\r?\n$/, '');
		const trimmed = line.trim();

		if (fenceMarker) {
			mark(mask, start, start + raw.length);
			if (trimmed.startsWith(fenceMarker)) fenceMarker = '';
			continue;
		}

		const opening = FENCE_OPEN.exec(line);
		if (opening) {
			fenceMarker = opening[1];
			mark(mask, start, start + raw.length);
			continue;
		}

		if (GALLERY_OPEN.test(trimmed)) {
			openGalleries.push(galleryFences.length);
			galleryFences.push({ index: start + line.indexOf(':'), line: i, closeIndex: null });
			continue;
		}

		if (GALLERY_CLOSE.test(trimmed) && openGalleries.length) {
			const at = openGalleries.pop();
			galleryFences[at].closeIndex = start + line.indexOf(':');
		}
	}

	// Inline code and HTML comments, outside anything already masked.
	for (const pattern of [/(`+)[^\n]*?\1/g, /<!--[\s\S]*?-->/g]) {
		pattern.lastIndex = 0;
		let match;
		while ((match = pattern.exec(text))) {
			if (mask[match.index]) continue;
			mark(mask, match.index, match.index + match[0].length);
		}
	}

	/** @type {ScanResult['script']} */
	let script = null;
	const scriptOpen = INSTANCE_SCRIPT.exec(text);
	if (scriptOpen && !mask[scriptOpen.index]) {
		const openEnd = scriptOpen.index + scriptOpen[0].length;
		const closeAt = text.indexOf('</script>', openEnd);
		script = { openStart: scriptOpen.index, openEnd, close: closeAt === -1 ? null : closeAt };
		mark(mask, openEnd, closeAt === -1 ? text.length : closeAt);
	}

	/** @type {ScannedImage[]} */
	const images = [];
	IMAGE.lastIndex = 0;
	let imageMatch;
	while ((imageMatch = IMAGE.exec(text))) {
		if (mask[imageMatch.index]) continue;
		const url = imageMatch[2].replace(/^<|>$/g, '');
		images.push({
			index: imageMatch.index,
			length: imageMatch[0].length,
			alt: imageMatch[1],
			altIndex: imageMatch.index + 2,
			url,
			urlIndex: imageMatch.index + imageMatch[0].indexOf(imageMatch[2])
		});
	}

	/** @type {{ url: string, index: number }[]} */
	const attrUrls = [];
	ATTR_URL.lastIndex = 0;
	let attrMatch;
	while ((attrMatch = ATTR_URL.exec(text))) {
		if (mask[attrMatch.index]) continue;
		attrUrls.push({
			url: attrMatch[1],
			index: attrMatch.index + attrMatch[0].indexOf(attrMatch[1])
		});
	}

	/** @type {{ index: number, text: string }[]} */
	const braceSpans = [];
	const brace = /\{[^{}\n]*\}/g;
	let braceMatch;
	while ((braceMatch = brace.exec(text))) {
		if (mask[braceMatch.index]) continue;
		braceSpans.push({ index: braceMatch.index, text: braceMatch[0] });
	}

	return { frontmatter, script, images, attrUrls, galleryFences, braceSpans, protectedMask: mask };
}

module.exports = { scanMarkdown };

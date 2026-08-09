'use strict';

/**
 * Filenames for dropped media.
 *
 * Two things decide the name: whether the original said anything (`IMG_8650`
 * does not, `korean-air-gate` does) and what is already in the folder.
 */

/**
 * Lowercase, separator-collapsed, and stripped of everything that is not a
 * letter or a digit in any script — a Korean filename in a Korean post stays
 * readable, and `Screen Shot 2024.png` stops carrying spaces into a URL.
 *
 * @param {string} value
 */
function kebabCase(value) {
	return String(value)
		.normalize('NFC')
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '');
}

/** Names a camera, a screenshot tool or a clipboard picked, which say nothing. */
const GENERIC = [
	/^img[-_ ]?\d*$/i,
	/^dsc[nf]?[-_ ]?\d*$/i,
	/^pxl[-_ ]?\d+/i,
	// `\b` is ASCII-only, so a Hangul prefix needs its own boundary.
	/^(?:screen[-_ ]?shot|스크린샷|화면[-_ ]?캡처)(?:[\s_-]|\d|$)/i,
	/^(?:image|photo|picture|untitled|unnamed|download|pasted[-_ ]?image|clipboard|capture)[-_ ]?\d*$/i,
	/^\d+$/,
	// Apple Photos exports: a UUID, sometimes with a `_1_105_c` suffix.
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
	/^[0-9a-f]{24,}$/i
];

/** @param {string} base  filename without extension */
function isGenericName(base) {
	const trimmed = String(base).trim();
	if (!trimmed) return true;
	return GENERIC.some((pattern) => pattern.test(trimmed));
}

/**
 * The stem a dropped file should use, or `null` when it should be numbered
 * after the slug instead.
 *
 * @param {{ original?: string, strategy?: 'auto' | 'original' | 'sequence' }} input
 * @returns {string | null}
 */
function preferredStem(input) {
	const strategy = input.strategy ?? 'auto';
	if (strategy === 'sequence') return null;

	const original = String(input.original ?? '').replace(/\.[^.]*$/, '');
	if (strategy === 'auto' && isGenericName(original)) return null;

	const stem = kebabCase(original);
	return stem || null;
}

/**
 * `slug-1`, `slug-2`, ... skipping whatever is already there.
 *
 * @param {string} slug
 * @param {Set<string>} taken  lowercase stems already in the folder
 */
function nextSequenceStem(slug, taken) {
	const base = kebabCase(slug) || 'image';
	for (let n = 1; ; n += 1) {
		const candidate = `${base}-${n}`;
		if (!taken.has(candidate)) return candidate;
	}
}

/**
 * `stem`, then `stem-2`, `stem-3`, ...
 *
 * @param {string} stem
 * @param {Set<string>} taken
 */
function dedupeStem(stem, taken) {
	if (!taken.has(stem)) return stem;
	for (let n = 2; ; n += 1) {
		const candidate = `${stem}-${n}`;
		if (!taken.has(candidate)) return candidate;
	}
}

/**
 * Full filename for one dropped file. `taken` is mutated so a batch of drops
 * numbers itself without re-reading the folder between files.
 *
 * @param {{ original?: string, extension: string, slug: string, strategy?: 'auto' | 'original' | 'sequence' }} input
 * @param {Set<string>} taken  lowercase stems already in the folder
 */
function fileNameFor(input, taken) {
	const preferred = preferredStem(input);
	const stem = preferred ? dedupeStem(preferred, taken) : nextSequenceStem(input.slug, taken);

	taken.add(stem);
	return `${stem}${input.extension}`;
}

/** Slugify a title the way the content tree spells slugs. */
function slugify(title) {
	return kebabCase(title);
}

module.exports = {
	dedupeStem,
	fileNameFor,
	isGenericName,
	kebabCase,
	nextSequenceStem,
	preferredStem,
	slugify
};

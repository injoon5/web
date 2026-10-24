/**
 * Smaller copies of every photo, and the `srcset` that offers them.
 *
 * Node-only (it hashes). The `sizes` that go with these copies are in
 * `image-sizes.js`, which the browser can load.
 *
 * `scripts/optimize-images.mjs` writes the files at build time, from the same
 * git-HEAD source as the optimized original, and records them in
 * `VARIANTS_MANIFEST`. `remarkImageSize` reads that record and gives each
 * article `<img>` a `srcset`; the lightbox carries the same `srcset` to a
 * full-screen `sizes`, so a phone downloads a phone's worth of photo and the
 * lightbox a screen's worth.
 *
 * Both halves read this module, so the names the script writes are the names
 * the markup asks for. Without a manifest — a dev server nobody has run the
 * image step for — nothing gets a `srcset` and every image is exactly what it
 * was: the original file, at its own size.
 */

import { createHash } from 'node:crypto';

/** Widths a photo is offered at, below its own. Phones at 3x land near 1280. */
export const VARIANT_WIDTHS = [640, 960, 1280, 1920];

/** WebP quality for the copies. Part of every file's name, via `variantKey`. */
export const VARIANT_QUALITY = 80;

/** Where the script records what it wrote, relative to the project root. */
export const VARIANTS_MANIFEST = '.cache/image-variants.json';

/**
 * The widths worth generating for an image `width` px wide. A copy within 15%
 * of the original saves too little to be worth a request, and none is wider.
 *
 * @param {number} width
 * @returns {number[]}
 */
export function variantWidths(width) {
	return VARIANT_WIDTHS.filter((w) => w <= width * 0.85);
}

/**
 * A short hash of everything that decides a copy's bytes. It is in the file
 * name because `/images` is served `immutable` for a year: a new source or new
 * settings has to be a new URL, or browsers keep the old one.
 *
 * @param {string} inputHash the source file's content hash
 * @param {number} width
 */
export function variantKey(inputHash, width) {
	return createHash('sha256')
		.update(`${inputHash}:${width}:webp:${VARIANT_QUALITY}`)
		.digest('hex')
		.slice(0, 10);
}

/**
 * `static/images/a/photo.jpeg` → `static/images/a/photo.w960.<key>.webp`.
 *
 * @param {string} rel
 * @param {number} width
 * @param {string} key
 */
export function variantPath(rel, width, key) {
	return `${rel.replace(/\.[^./]+$/, '')}.w${width}.${key}.webp`;
}

/**
 * A URL that survives being a `srcset` candidate: whitespace separates
 * candidates and a trailing comma ends one, so both are escaped. Hangul and
 * parentheses — both in real file names here — are left as they are.
 *
 * @param {string} url
 */
function candidateUrl(url) {
	return url.replace(/[\s,]/g, (c) => encodeURIComponent(c));
}

/**
 * @typedef {{ width: number, height: number, candidates: { url: string, w: number }[] }} VariantEntry
 */

/**
 * @param {VariantEntry} entry
 * @returns {string}
 */
export function srcsetOf(entry) {
	return entry.candidates.map((c) => `${candidateUrl(c.url)} ${c.w}w`).join(', ');
}

/**
 * What the three image steps hand each other through `.cache/` (restored across
 * deploys by turbo; its `outputs` in turbo.json name the same paths):
 *
 * - fingerprint-images writes `FINGERPRINTS`: `{ files: { [rel]: contentHash } }`
 *   for every tracked raster image at git HEAD.
 * - optimize-images reads it, writes the optimized originals and their copies
 *   under `MIRROR_DIR` and records them in `OPTIMIZE_MANIFEST`.
 * - apply-optimized-images copies the mirror onto `static/` for the build.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE_DIR = path.join(ROOT, '.cache');
export const FINGERPRINTS = path.join(CACHE_DIR, 'source-fingerprints.json');
export const OPTIMIZE_MANIFEST = path.join(CACHE_DIR, 'image-optimize.json');
export const MIRROR_DIR = path.join(CACHE_DIR, 'image-mirror');

/** The images the steps touch. Animated GIFs stay exactly as committed. */
export const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/**
 * `{ [rel]: contentHash }` from the fingerprint step, or null if it has not run.
 * @returns {Promise<Record<string, string> | null>}
 */
export async function readFingerprints() {
	try {
		return JSON.parse(await readFile(FINGERPRINTS, 'utf8')).files ?? {};
	} catch {
		return null;
	}
}

#!/usr/bin/env node
/**
 * Copy optimized image mirrors from .cache/ onto static/ for the build, with
 * each image's responsive copies beside it (`*.w960.<key>.webp`, gitignored).
 * Uncached in turbo.json, so it runs even when build-image-cache was restored
 * from the cache — static/ is not in that task's outputs.
 */

import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { MIRROR_DIR, OPTIMIZE_MANIFEST, ROOT, readFingerprints } from './lib/image-cache.js';

/**
 * @param {string} src
 * @param {string} dest
 */
async function copyFileEnsuringDir(src, dest) {
	await mkdir(path.dirname(dest), { recursive: true });
	await copyFile(src, dest);
}

async function main() {
	const files = await readFingerprints();
	if (!files) {
		console.error('Missing .cache/source-fingerprints.json — run fingerprint-images first');
		process.exit(1);
	}

	let manifest = {};
	try {
		manifest = JSON.parse(await readFile(OPTIMIZE_MANIFEST, 'utf8'));
	} catch {
		console.error('Missing .cache/image-optimize.json — run build-image-cache first');
		process.exit(1);
	}

	let applied = 0;
	let missing = 0;
	let copies = 0;

	for (const rel of Object.keys(files)) {
		const mirror = path.join(MIRROR_DIR, rel);
		const dest = path.join(ROOT, rel);

		if (!manifest[rel]) {
			missing += 1;
			console.warn(`warn: no manifest entry for ${rel}`);
			continue;
		}

		try {
			await stat(mirror);
			await copyFileEnsuringDir(mirror, dest);
			applied += 1;
		} catch {
			missing += 1;
			console.warn(`warn: missing mirror for ${rel}`);
		}

		for (const variant of manifest[rel].variants ?? []) {
			try {
				await copyFileEnsuringDir(
					path.join(MIRROR_DIR, variant.file),
					path.join(ROOT, variant.file)
				);
				copies += 1;
			} catch {
				missing += 1;
				console.warn(`warn: missing responsive copy ${variant.file}`);
			}
		}
	}

	console.log(
		`Applied ${applied} optimized images and ${copies} responsive copies to static/ (${missing} missing)`
	);
	if (missing > 0) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

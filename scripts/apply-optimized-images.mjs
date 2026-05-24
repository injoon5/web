#!/usr/bin/env node
/**
 * Copy optimized image mirrors from .cache/ onto static/ for the build.
 * Always runs after build-image-cache (even on turbo cache hit).
 */

import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATIC_DIR = path.join(ROOT, 'static');
const MIRROR_DIR = path.join(ROOT, '.cache', 'image-mirror');
const FINGERPRINT_PATH = path.join(ROOT, '.cache', 'source-fingerprints.json');
const MANIFEST_PATH = path.join(ROOT, '.cache', 'image-optimize.json');

/**
 * @param {string} src
 * @param {string} dest
 */
async function copyFileEnsuringDir(src, dest) {
	await mkdir(path.dirname(dest), { recursive: true });
	await copyFile(src, dest);
}

async function main() {
	let fingerprint;
	try {
		fingerprint = JSON.parse(await readFile(FINGERPRINT_PATH, 'utf8'));
	} catch {
		console.error('Missing .cache/source-fingerprints.json — run fingerprint-images first');
		process.exit(1);
	}

	let manifest = {};
	try {
		manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
	} catch {
		console.error('Missing .cache/image-optimize.json — run build-image-cache first');
		process.exit(1);
	}

	const files = fingerprint.files ?? {};
	let applied = 0;
	let missing = 0;

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
	}

	// Ensure static dir exists even if there are zero images.
	await mkdir(STATIC_DIR, { recursive: true });

	console.log(`Applied ${applied} optimized images to static/ (${missing} missing)`);
	if (missing > 0) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

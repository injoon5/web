#!/usr/bin/env node
/**
 * Losslessly-ish compress raster images from git into .cache/image-mirror/.
 * apply-optimized-images.mjs copies mirrors onto static/ for the build.
 *
 * Source bytes always come from git HEAD so optimized static/ files never
 * bust the manifest. Turbo Remote Cache restores .cache/ across deploys.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache');
const MANIFEST_PATH = path.join(CACHE_DIR, 'image-optimize.json');
const FINGERPRINT_PATH = path.join(CACHE_DIR, 'source-fingerprints.json');
const MIRROR_DIR = path.join(CACHE_DIR, 'image-mirror');

/** Max width for blog/photo assets (2x typical content column). */
const MAX_WIDTH = Number.parseInt(process.env.IMAGE_MAX_WIDTH ?? '2400', 10);
/** Max height — same bounding box as width so tall portraits get resized too. */
const MAX_HEIGHT = Number.parseInt(process.env.IMAGE_MAX_HEIGHT ?? '2400', 10);
const JPEG_QUALITY = Number.parseInt(process.env.JPEG_QUALITY ?? '88', 10);
const PNG_COMPRESSION = Number.parseInt(process.env.PNG_COMPRESSION ?? '9', 10);
const WEBP_QUALITY = Number.parseInt(process.env.WEBP_QUALITY ?? '85', 10);

const SETTINGS_KEY = [MAX_WIDTH, MAX_HEIGHT, JPEG_QUALITY, PNG_COMPRESSION, WEBP_QUALITY].join(':');

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
const verbose = process.argv.includes('--verbose') || dryRun;

/** @type {Record<string, { input: string, settings: string }>} */
let manifest = {};

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileOptions} [options]
 */
async function run(cmd, args, options = {}) {
	const { stdout } = await execFileAsync(cmd, args, {
		cwd: ROOT,
		maxBuffer: 64 * 1024 * 1024,
		...options
	});
	return stdout;
}

async function loadManifest() {
	try {
		const raw = await readFile(MANIFEST_PATH, 'utf8');
		manifest = JSON.parse(raw);
	} catch {
		manifest = {};
	}
}

async function saveManifest() {
	if (dryRun) return;
	await mkdir(CACHE_DIR, { recursive: true });
	await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function mirrorPath(rel) {
	return path.join(MIRROR_DIR, rel);
}

/**
 * @param {string} rel
 */
async function readGitSource(rel) {
	return run('git', ['show', `HEAD:${rel}`], { encoding: 'buffer' });
}

/**
 * @param {sharp.Sharp} pipeline
 * @param {string} ext
 */
function encodeForExt(pipeline, ext) {
	switch (ext) {
		case '.jpg':
		case '.jpeg':
			return pipeline.jpeg({
				quality: JPEG_QUALITY,
				mozjpeg: true,
				progressive: true
			});
		case '.png':
			return pipeline.png({
				compressionLevel: PNG_COMPRESSION,
				palette: false,
				effort: 10
			});
		case '.webp':
			return pipeline.webp({
				quality: WEBP_QUALITY,
				effort: 6
			});
		default:
			return pipeline;
	}
}

/**
 * @param {string} rel
 * @param {string} inputHash
 * @param {Buffer} sourceBuf
 */
async function optimizeFile(rel, inputHash, sourceBuf) {
	const ext = path.extname(rel).toLowerCase();
	const beforeSize = sourceBuf.length;
	const cached = manifest[rel];
	const mirror = mirrorPath(rel);

	if (!force && cached?.input === inputHash && cached?.settings === SETTINGS_KEY) {
		try {
			const mirrorStat = await stat(mirror);
			if (mirrorStat.isFile()) {
				if (verbose) console.log(`skip (cached): ${rel}`);
				return { rel, skipped: true, saved: 0 };
			}
		} catch {
			// Mirror missing or unreadable — fall through and re-optimize.
		}
	}

	const meta = await sharp(sourceBuf).metadata();
	let pipeline = sharp(sourceBuf, { failOn: 'none' }).rotate();

	const width = meta.width ?? 0;
	const height = meta.height ?? 0;
	if (width > MAX_WIDTH || height > MAX_HEIGHT) {
		pipeline = pipeline.resize({
			width: MAX_WIDTH,
			height: MAX_HEIGHT,
			withoutEnlargement: true,
			fit: 'inside'
		});
	}

	pipeline = encodeForExt(pipeline, ext);
	const outBuf = await pipeline.toBuffer();

	if (outBuf.length >= beforeSize) {
		manifest[rel] = { input: inputHash, settings: SETTINGS_KEY };
		if (dryRun) {
			if (verbose) {
				console.log(
					`skip (no gain): ${rel} (${formatBytes(beforeSize)} -> ${formatBytes(outBuf.length)})`
				);
			}
			return { rel, skipped: true, saved: 0 };
		}
		await mkdir(path.dirname(mirror), { recursive: true });
		await writeFile(mirror, sourceBuf);
		if (verbose) {
			console.log(
				`skip (no gain): ${rel} (${formatBytes(beforeSize)} -> ${formatBytes(outBuf.length)})`
			);
		}
		return { rel, skipped: true, saved: 0 };
	}

	if (dryRun) {
		console.log(
			`would optimize: ${rel} ${formatBytes(beforeSize)} -> ${formatBytes(outBuf.length)} (${pctSaved(beforeSize, outBuf.length)})`
		);
		return { rel, skipped: false, saved: beforeSize - outBuf.length };
	}

	const tmp = `${mirror}.opt.tmp`;
	await mkdir(path.dirname(mirror), { recursive: true });
	await writeFile(tmp, outBuf);
	await rename(tmp, mirror);
	manifest[rel] = { input: inputHash, settings: SETTINGS_KEY };

	const saved = beforeSize - outBuf.length;
	console.log(
		`optimized: ${rel} ${formatBytes(beforeSize)} -> ${formatBytes(outBuf.length)} (${pctSaved(beforeSize, outBuf.length)})`
	);
	return { rel, skipped: false, saved };
}

function formatBytes(n) {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function pctSaved(before, after) {
	return `${(((before - after) / before) * 100).toFixed(1)}% smaller`;
}

async function main() {
	if (!Number.isFinite(MAX_WIDTH) || MAX_WIDTH < 1) {
		console.error('IMAGE_MAX_WIDTH must be a positive integer');
		process.exit(1);
	}
	if (!Number.isFinite(MAX_HEIGHT) || MAX_HEIGHT < 1) {
		console.error('IMAGE_MAX_HEIGHT must be a positive integer');
		process.exit(1);
	}

	let fingerprint;
	try {
		fingerprint = JSON.parse(await readFile(FINGERPRINT_PATH, 'utf8'));
	} catch {
		console.error('Missing .cache/source-fingerprints.json — run fingerprint-images first');
		process.exit(1);
	}

	await loadManifest();

	const files = fingerprint.files ?? {};
	let totalSaved = 0;
	let optimized = 0;
	let skipped = 0;

	for (const [rel, inputHash] of Object.entries(files)) {
		try {
			const sourceBuf = await readGitSource(rel);
			const result = await optimizeFile(rel, inputHash, sourceBuf);
			if (result.skipped) skipped += 1;
			else optimized += 1;
			totalSaved += result.saved;
		} catch (err) {
			console.error(`failed: ${rel}`, err instanceof Error ? err.message : err);
			process.exitCode = 1;
		}
	}

	await saveManifest();

	const mode = dryRun ? ' (dry run)' : '';
	console.log(
		`\nImage optimize${mode}: ${optimized} updated, ${skipped} skipped, saved ${formatBytes(totalSaved)}`
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

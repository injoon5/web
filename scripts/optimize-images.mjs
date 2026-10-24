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
import {
	VARIANTS_MANIFEST,
	VARIANT_QUALITY,
	variantKey,
	variantPath,
	variantWidths
} from '../src/lib/markdown/image-variants.js';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache');
const MANIFEST_PATH = path.join(CACHE_DIR, 'image-optimize.json');
const FINGERPRINT_PATH = path.join(CACHE_DIR, 'source-fingerprints.json');
const VARIANTS_PATH = path.join(ROOT, VARIANTS_MANIFEST);

/** Animated GIFs stay as they are; everything else gets smaller copies. */
const VARIANT_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
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

/**
 * The display size of the optimized original: rotated as the browser will draw
 * it, and capped the way `optimizeFile` caps it.
 *
 * @param {Buffer} sourceBuf
 */
async function displaySize(sourceBuf) {
	const meta = await sharp(sourceBuf).metadata();
	const width = meta.autoOrient?.width ?? meta.width ?? 0;
	const height = meta.autoOrient?.height ?? meta.height ?? 0;
	const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
	return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Smaller WebP copies of one image, for its `srcset` — see
 * `src/lib/markdown/image-variants.js`. Written into the mirror beside the
 * optimized original, so the same cache restores both and the same apply step
 * puts both in `static/`.
 *
 * A full-size WebP is kept only when it beats the optimized original; when it
 * does not, the original is the top candidate itself.
 *
 * @param {string} rel
 * @param {string} inputHash
 * @param {Buffer} sourceBuf
 * @returns {Promise<{ written: number }>}
 */
async function buildVariants(rel, inputHash, sourceBuf) {
	const entry = manifest[rel];
	if (!entry) return { written: 0 };
	// Article images only: nothing outside `static/images` is ever given a
	// srcset. A list left from before that rule would name files nobody writes.
	if (!rel.startsWith('static/images/') || !VARIANT_EXT.has(path.extname(rel).toLowerCase())) {
		delete entry.variants;
		return { written: 0 };
	}

	const settings = `${VARIANT_QUALITY}`;
	if (!force && entry.variantInput === inputHash && entry.variantSettings === settings) {
		const files = (entry.variants ?? []).map((v) => mirrorPath(v.file));
		const present = await Promise.all(
			files.map((f) =>
				stat(f).then(
					() => true,
					() => false
				)
			)
		);
		if (present.every(Boolean)) return { written: 0 };
	}

	const { width, height } = await displaySize(sourceBuf);
	const original = await stat(mirrorPath(rel)).then(
		(s) => s.size,
		() => Infinity
	);
	/** @type {{ w: number, h: number, file: string }[]} */
	const variants = [];
	for (const w of [...variantWidths(width), width]) {
		const out = await sharp(sourceBuf, { failOn: 'none' })
			.rotate()
			.resize({ width: w, withoutEnlargement: true })
			.webp({ quality: VARIANT_QUALITY, effort: 5, smartSubsample: true })
			.toBuffer();
		if (w === width && out.length >= original) continue;
		const file = variantPath(rel, w, variantKey(inputHash, w));
		if (!dryRun) {
			await mkdir(path.dirname(mirrorPath(file)), { recursive: true });
			await writeFile(mirrorPath(file), out);
		}
		variants.push({ w, h: Math.round((height * w) / width), file });
	}

	Object.assign(entry, {
		variantInput: inputHash,
		variantSettings: settings,
		width,
		height,
		variants
	});
	if (verbose) console.log(`variants: ${rel} ${variants.map((v) => v.w).join(', ') || 'none'}`);
	return { written: variants.length };
}

/**
 * What the markdown build reads: each image's site URL, its size, and the
 * candidates for its `srcset`, smallest first.
 */
async function saveVariantsManifest() {
	if (dryRun) return;
	/** @type {Record<string, { width: number, height: number, candidates: { url: string, w: number }[] }>} */
	const out = {};
	for (const [rel, entry] of Object.entries(manifest)) {
		if (!entry.variants?.length || !rel.startsWith('static/images/')) continue;
		const url = (file) => `/${path.relative('static', file).split(path.sep).join('/')}`;
		const candidates = entry.variants.map((v) => ({ url: url(v.file), w: v.w }));
		if (!entry.variants.some((v) => v.w === entry.width)) {
			candidates.push({ url: url(rel), w: entry.width });
		}
		out[url(rel)] = { width: entry.width, height: entry.height, candidates };
	}
	await mkdir(path.dirname(VARIANTS_PATH), { recursive: true });
	await writeFile(VARIANTS_PATH, JSON.stringify(out, null, 2));
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
	let copies = 0;

	for (const [rel, inputHash] of Object.entries(files)) {
		try {
			const sourceBuf = await readGitSource(rel);
			const result = await optimizeFile(rel, inputHash, sourceBuf);
			if (result.skipped) skipped += 1;
			else optimized += 1;
			totalSaved += result.saved;
			copies += (await buildVariants(rel, inputHash, sourceBuf)).written;
		} catch (err) {
			console.error(`failed: ${rel}`, err instanceof Error ? err.message : err);
			process.exitCode = 1;
		}
	}

	await saveManifest();
	await saveVariantsManifest();

	const mode = dryRun ? ' (dry run)' : '';
	console.log(
		`\nImage optimize${mode}: ${optimized} updated, ${skipped} skipped, saved ${formatBytes(totalSaved)}, ${copies} responsive copies written`
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

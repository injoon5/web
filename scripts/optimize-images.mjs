#!/usr/bin/env node
/**
 * Losslessly-ish compress raster images under static/ before deploy.
 * Keeps original paths/extensions so markdown image URLs stay valid.
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATIC_DIR = path.join(ROOT, 'static');
const CACHE_PATH = path.join(ROOT, '.cache', 'image-optimize.json');

const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.svelte-kit', 'build']);

/** Max width for blog/photo assets (2x typical content column). */
const MAX_WIDTH = Number.parseInt(process.env.IMAGE_MAX_WIDTH ?? '1920', 10);
const JPEG_QUALITY = Number.parseInt(process.env.JPEG_QUALITY ?? '82', 10);
const PNG_COMPRESSION = Number.parseInt(process.env.PNG_COMPRESSION ?? '9', 10);
const WEBP_QUALITY = Number.parseInt(process.env.WEBP_QUALITY ?? '80', 10);

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
const verbose = process.argv.includes('--verbose') || dryRun;

/** @type {Record<string, string>} */
let cache = {};

async function loadCache() {
	try {
		const raw = await readFile(CACHE_PATH, 'utf8');
		cache = JSON.parse(raw);
	} catch {
		cache = {};
	}
}

async function saveCache() {
	if (dryRun) return;
	await mkdir(path.dirname(CACHE_PATH), { recursive: true });
	await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function fileDigest(filePath) {
	const buf = await readFile(filePath);
	return createHash('sha256').update(buf).digest('hex');
}

/**
 * @param {string} dir
 * @returns {AsyncGenerator<string>}
 */
async function* walkRasterFiles(dir) {
	let entries;
	try {
		entries = await stat(dir);
	} catch {
		return;
	}
	if (!entries.isDirectory()) return;

	const names = await readdir(dir, { withFileTypes: true });
	for (const entry of names) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) continue;
			yield* walkRasterFiles(full);
			continue;
		}
		if (!entry.isFile()) continue;
		const ext = path.extname(entry.name).toLowerCase();
		if (RASTER_EXT.has(ext)) yield full;
	}
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
 * @param {string} filePath
 */
async function optimizeFile(filePath) {
	const rel = path.relative(ROOT, filePath);
	const ext = path.extname(filePath).toLowerCase();
	const beforeStat = await stat(filePath);
	const digest = await fileDigest(filePath);

	if (!force && cache[rel] === digest) {
		if (verbose) console.log(`skip (cached): ${rel}`);
		return { rel, skipped: true, saved: 0 };
	}

	const meta = await sharp(filePath).metadata();
	let pipeline = sharp(filePath, { failOn: 'none' }).rotate(); // respect EXIF orientation, then strip

	const width = meta.width ?? 0;
	if (width > MAX_WIDTH) {
		pipeline = pipeline.resize({
			width: MAX_WIDTH,
			withoutEnlargement: true,
			fit: 'inside'
		});
	}

	pipeline = encodeForExt(pipeline, ext);
	const outBuf = await pipeline.toBuffer();

	if (outBuf.length >= beforeStat.size) {
		cache[rel] = digest;
		if (verbose) {
			console.log(
				`skip (no gain): ${rel} (${formatBytes(beforeStat.size)} -> ${formatBytes(outBuf.length)})`
			);
		}
		return { rel, skipped: true, saved: 0 };
	}

	if (dryRun) {
		console.log(
			`would optimize: ${rel} ${formatBytes(beforeStat.size)} -> ${formatBytes(outBuf.length)} (${pctSaved(beforeStat.size, outBuf.length)})`
		);
		return { rel, skipped: false, saved: beforeStat.size - outBuf.length };
	}

	const tmp = `${filePath}.opt.tmp`;
	await writeFile(tmp, outBuf);
	await rename(tmp, filePath);
	cache[rel] = await fileDigest(filePath);

	const saved = beforeStat.size - outBuf.length;
	console.log(`optimized: ${rel} ${formatBytes(beforeStat.size)} -> ${formatBytes(outBuf.length)} (${pctSaved(beforeStat.size, outBuf.length)})`);
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

	await loadCache();

	let totalSaved = 0;
	let optimized = 0;
	let skipped = 0;

	for await (const filePath of walkRasterFiles(STATIC_DIR)) {
		try {
			const result = await optimizeFile(filePath);
			if (result.skipped) skipped += 1;
			else optimized += 1;
			totalSaved += result.saved;
		} catch (err) {
			const rel = path.relative(ROOT, filePath);
			console.error(`failed: ${rel}`, err instanceof Error ? err.message : err);
			process.exitCode = 1;
		}
	}

	await saveCache();

	const mode = dryRun ? ' (dry run)' : '';
	console.log(
		`\nImage optimize${mode}: ${optimized} updated, ${skipped} skipped, saved ${formatBytes(totalSaved)}`
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

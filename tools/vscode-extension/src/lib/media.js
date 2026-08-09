'use strict';

const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');

/** Extensions a browser will render directly. */
const WEB_IMAGE = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg']);
/** Extensions that have to be converted before they are worth committing. */
const CONVERT_IMAGE = new Set(['.heic', '.heif', '.tif', '.tiff', '.bmp']);
const VIDEO = new Set(['.mp4', '.webm', '.mov', '.m4v']);

const MIME_EXTENSION = {
	'image/png': '.png',
	'image/jpeg': '.jpg',
	'image/jpg': '.jpg',
	'image/webp': '.webp',
	'image/gif': '.gif',
	'image/avif': '.avif',
	'image/svg+xml': '.svg',
	'image/heic': '.heic',
	'image/heif': '.heif',
	'image/tiff': '.tiff',
	'image/bmp': '.bmp',
	'video/mp4': '.mp4',
	'video/webm': '.webm',
	'video/quicktime': '.mov'
};

/** @param {string} name */
function extensionOf(name) {
	const ext = path.extname(String(name)).toLowerCase();
	return ext === '.jpeg' ? '.jpeg' : ext;
}

/**
 * @param {string} name
 * @param {string} [mime]
 * @returns {'image' | 'video' | null}
 */
function mediaKind(name, mime) {
	const ext = extensionOf(name) || MIME_EXTENSION[String(mime).toLowerCase()] || '';
	if (WEB_IMAGE.has(ext) || CONVERT_IMAGE.has(ext)) return 'image';
	if (VIDEO.has(ext)) return 'video';
	if (String(mime).startsWith('image/')) return 'image';
	if (String(mime).startsWith('video/')) return 'video';
	return null;
}

/** @param {string} mime */
function extensionForMime(mime) {
	return MIME_EXTENSION[String(mime).toLowerCase()] ?? '';
}

/** @param {string} extension */
function needsConversion(extension) {
	return CONVERT_IMAGE.has(String(extension).toLowerCase());
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string }} [options]
 */
function run(cmd, args, options = {}) {
	return new Promise((resolve, reject) => {
		execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...options }, (error, stdout) => {
			if (error) reject(error);
			else resolve(stdout);
		});
	});
}

/**
 * Re-encode through the workspace's own `sharp`.
 *
 * It runs in a child process rather than in the extension host: sharp ships
 * prebuilt binaries compiled against Node's ABI, and the extension host is
 * Electron's, so requiring it here fails on exactly the machines it would
 * otherwise work on.
 *
 * @param {string} workspaceRoot
 * @param {string} input   absolute path
 * @param {string} output  absolute path
 * @param {{ format: 'jpeg' | 'webp', maxWidth: number }} options
 */
async function transcodeWithSharp(workspaceRoot, input, output, options) {
	const script = [
		"const sharp = require('sharp');",
		'const [input, output, format, maxWidth] = process.argv.slice(1);',
		'let pipeline = sharp(input).rotate();',
		'if (Number(maxWidth) > 0) {',
		"  pipeline = pipeline.resize({ width: Number(maxWidth), height: Number(maxWidth), fit: 'inside', withoutEnlargement: true });",
		'}',
		"pipeline = format === 'webp' ? pipeline.webp({ quality: 85 }) : pipeline.jpeg({ quality: 88, mozjpeg: true });",
		'pipeline.toFile(output).then(() => process.exit(0), (error) => { console.error(error.message); process.exit(1); });'
	].join('\n');

	await run('node', ['-e', script, input, output, options.format, String(options.maxWidth)], {
		cwd: workspaceRoot
	});
}

/**
 * macOS ships `sips`, which reads HEIC without anything installed. It is the
 * fallback that makes an iPhone screenshot work on a fresh checkout.
 *
 * @param {string} input
 * @param {string} output
 * @param {{ format: 'jpeg' | 'webp', maxWidth: number }} options
 */
async function transcodeWithSips(input, output, options) {
	if (os.platform() !== 'darwin') throw new Error('sips is macOS only');
	const args = ['-s', 'format', options.format === 'webp' ? 'webp' : 'jpeg'];
	if (options.maxWidth > 0) args.push('-Z', String(options.maxWidth));
	args.push(input, '--out', output);
	await run('sips', args);
}

/**
 * Convert bytes in memory, returning the original untouched if nothing on the
 * machine can do it. A copied-but-unconverted HEIC is still better than a
 * failed drop — the diagnostics flag it, and the message says why.
 *
 * @param {Uint8Array} bytes
 * @param {{ workspaceRoot: string, extension: string, format: 'jpeg' | 'webp', maxWidth: number }} options
 * @returns {Promise<{ bytes: Uint8Array, extension: string, converted: boolean, reason?: string }>}
 */
async function transcode(bytes, options) {
	const target = options.format === 'webp' ? '.webp' : '.jpg';
	const dir = await mkdtemp(path.join(os.tmpdir(), 'web-authoring-'));
	const input = path.join(dir, `in${options.extension || '.bin'}`);
	const output = path.join(dir, `out${target}`);

	try {
		await writeFile(input, bytes);

		const attempts = [
			() => transcodeWithSharp(options.workspaceRoot, input, output, options),
			() => transcodeWithSips(input, output, options)
		];

		/** @type {Error | null} */
		let last = null;
		for (const attempt of attempts) {
			try {
				await attempt();
				const converted = await readFile(output);
				return { bytes: new Uint8Array(converted), extension: target, converted: true };
			} catch (error) {
				last = /** @type {Error} */ (error);
			}
		}

		return {
			bytes,
			extension: options.extension,
			converted: false,
			reason: last ? last.message : 'no converter available'
		};
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

module.exports = {
	CONVERT_IMAGE,
	VIDEO,
	WEB_IMAGE,
	extensionForMime,
	extensionOf,
	mediaKind,
	needsConversion,
	transcode
};

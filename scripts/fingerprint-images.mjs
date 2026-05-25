#!/usr/bin/env node
/**
 * Fingerprint tracked raster images from git HEAD (not the working tree).
 * Used as a stable turbo input so optimized bytes on disk do not bust cache.
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, '.cache', 'source-fingerprints.json');

const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/**
 * @param {string} cmd
 * @param {string[]} args
 */
async function git(cmd, args) {
	const { stdout } = await execFileAsync(cmd, args, { cwd: ROOT, maxBuffer: 10 * 1024 * 1024 });
	return stdout;
}

async function main() {
	const list = (await git('git', ['ls-files', '-z', '--', 'static'])).split('\0').filter(Boolean);
	/** @type {Record<string, string>} */
	const fingerprints = {};

	for (const rel of list) {
		const ext = path.extname(rel).toLowerCase();
		if (!RASTER_EXT.has(ext)) continue;
		try {
			const blob = await git('git', ['show', `HEAD:${rel}`]);
			fingerprints[rel] = createHash('sha256').update(blob).digest('hex');
		} catch {
			// Untracked or deleted in HEAD — fall back to working tree below.
		}
	}

	await mkdir(path.dirname(OUT_PATH), { recursive: true });
	await writeFile(
		OUT_PATH,
		JSON.stringify(
			{
				commit: (await git('git', ['rev-parse', 'HEAD'])).trim(),
				files: fingerprints
			},
			null,
			2
		)
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

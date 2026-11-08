#!/usr/bin/env node
/**
 * Fingerprint tracked raster images from git HEAD (not the working tree).
 * Used as a stable turbo input so optimized bytes on disk do not bust cache.
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { FINGERPRINTS, RASTER_EXT, ROOT } from './lib/image-cache.js';

const execFileAsync = promisify(execFile);

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
			// Staged but not yet committed, or deleted in HEAD. `optimize-images`
			// reads from HEAD too, so a file that isn't there has nothing to
			// optimize — leaving it out here keeps the two in step.
		}
	}

	// This file is the turbo cache key for image optimization, so it holds content
	// hashes and nothing else. A commit SHA in here would change on every deploy
	// and force a re-encode of every image even when none of them moved.
	await mkdir(path.dirname(FINGERPRINTS), { recursive: true });
	await writeFile(FINGERPRINTS, JSON.stringify({ files: fingerprints }, null, 2));
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

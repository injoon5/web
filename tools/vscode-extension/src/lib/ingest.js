'use strict';

const vscode = require('vscode');
const path = require('node:path');

const { buildMediaSnippet, componentImportEdit } = require('./insert');
const { fileNameFor } = require('./naming');
const media = require('./media');
const workspace = require('./workspace');

/**
 * Everything a drop, a paste and the insert command have in common: work out
 * what was handed over, file it under `static/` where the post's other media
 * lives, and hand back the markdown for it.
 */

/**
 * @typedef {Object} Candidate
 * @property {string} name
 * @property {string} [mime]
 * @property {vscode.Uri} [uri]
 * @property {() => Thenable<Uint8Array>} read
 */

/**
 * @param {vscode.DataTransfer} dataTransfer
 * @returns {Promise<Candidate[]>}
 */
async function candidatesFrom(dataTransfer) {
	/** @type {Candidate[]} */
	const out = [];
	/** @type {Set<string>} */
	const seen = new Set();

	// A drag out of Finder or the Explorer arrives as a URI list. Taking it
	// first keeps the original filename, and is the only way to notice that the
	// file is already inside `static/` and does not need copying at all.
	const uriList = dataTransfer.get('text/uri-list');
	if (uriList) {
		const raw = await uriList.asString();
		for (const line of raw.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;

			let uri;
			try {
				uri = vscode.Uri.parse(trimmed, true);
			} catch {
				continue;
			}
			if (uri.scheme !== 'file') continue;
			if (seen.has(uri.fsPath)) continue;

			seen.add(uri.fsPath);
			out.push({
				name: path.basename(uri.fsPath),
				uri,
				read: () => vscode.workspace.fs.readFile(uri)
			});
		}
	}

	for (const [mime, item] of dataTransfer) {
		const file = item.asFile?.();
		if (!file) continue;

		const key = file.uri ? file.uri.fsPath : `${mime}:${file.name}`;
		if (seen.has(key)) continue;

		seen.add(key);
		out.push({
			name: file.name || `pasted${media.extensionForMime(mime) || '.bin'}`,
			mime,
			uri: file.uri,
			read: () => file.data()
		});
	}

	return out;
}

/**
 * @param {ReturnType<typeof workspace.getConfig>} config
 * @param {'image' | 'video'} kind
 * @param {string} extension
 */
function shouldTranscode(config, kind, extension) {
	if (kind !== 'image') return false;
	if (config.transcode === 'off') return false;
	if (media.needsConversion(extension)) return true;
	if (config.transcode !== 'always') return false;
	return !['.svg', '.gif', '.avif'].includes(extension);
}

/**
 * Copy everything in, and describe what to type.
 *
 * @param {vscode.TextDocument} document
 * @param {Candidate[]} candidates
 * @param {vscode.CancellationToken} [token]
 * @returns {Promise<{ snippet: string, edit: vscode.WorkspaceEdit, entries: object[], notices: string[] } | null>}
 */
async function ingest(document, candidates, token) {
	const context = workspace.describe(document);
	if (!context) return null;

	const { config, folder } = context;
	const edit = new vscode.WorkspaceEdit();
	/** @type {import('./insert').MediaEntry[]} */
	const entries = [];
	/** @type {string[]} */
	const notices = [];
	/** @type {Map<string, Set<string>>} */
	const stemsByFolder = new Map();

	for (const candidate of candidates) {
		if (token?.isCancellationRequested) return null;

		const kind = media.mediaKind(candidate.name, candidate.mime);
		if (!kind) continue;

		// Already served by the site: link it, do not make a second copy.
		if (candidate.uri) {
			const existing = workspace.urlForUri(folder, config, candidate.uri);
			if (existing) {
				entries.push({ media: kind, url: existing });
				continue;
			}
		}

		const target = workspace.assetTarget(context, kind);
		if (!target) continue;

		const key = target.uri.toString();
		if (!stemsByFolder.has(key)) stemsByFolder.set(key, await workspace.takenStems(target.uri));
		const taken = /** @type {Set<string>} */ (stemsByFolder.get(key));

		let bytes = await candidate.read();
		let extension =
			media.extensionOf(candidate.name) || media.extensionForMime(candidate.mime ?? '') || '.bin';

		if (shouldTranscode(config, kind, extension)) {
			const result = await media.transcode(bytes, {
				workspaceRoot: folder.uri.fsPath,
				extension,
				format: config.transcodeTarget === 'webp' ? 'webp' : 'jpeg',
				maxWidth: Number(config.maxWidth) || 0
			});

			bytes = result.bytes;
			extension = result.extension;

			if (!result.converted && media.needsConversion(extension)) {
				notices.push(
					`${candidate.name} was copied as-is — no converter available (${result.reason}). Browsers cannot display ${extension}.`
				);
			}
		}

		const name = fileNameFor(
			{ original: candidate.name, extension, slug: target.slug, strategy: config.naming },
			taken
		);

		const fileUri = vscode.Uri.joinPath(target.uri, name);
		edit.createFile(fileUri, { contents: bytes, ignoreIfExists: false });
		entries.push({ media: kind, url: `${target.url}/${name}` });
	}

	if (!entries.length) return null;

	if (entries.some((entry) => entry.media === 'video')) {
		const importEdit = componentImportEdit(document.getText(), config.videoComponent);
		if (importEdit) {
			edit.insert(document.uri, document.positionAt(importEdit.offset), importEdit.insert);
		}
	}

	const snippet = buildMediaSnippet(entries, {
		altPlaceholder: config.altTextPlaceholder,
		componentName: config.videoComponent?.name ?? 'LazyVideo'
	});

	return { snippet, edit, entries, notices };
}

module.exports = { candidatesFrom, ingest };

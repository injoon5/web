'use strict';

const vscode = require('vscode');

const { blockInsertPadding } = require('../lib/insert');
const { candidatesFrom, ingest } = require('../lib/ingest');

/**
 * Drop and paste share everything except the API they are handed to VS Code
 * through, so they share an implementation here.
 *
 * The kind is the extension's own, which is what a workspace can name in
 * `editor.pasteAs.preferences` to make this win over the built-in markdown
 * handler — that one copies media next to the document instead of into
 * `static/`.
 */

const KIND_ID = 'image.webAuthoring';

function mediaEditKind() {
	const Kind = vscode.DocumentDropOrPasteEditKind;
	if (!Kind || typeof Kind.Empty?.append !== 'function') return undefined;
	try {
		return Kind.Empty.append('image', 'webAuthoring');
	} catch {
		return undefined;
	}
}

const MIME_TYPES = ['files', 'text/uri-list', 'image/*', 'video/*'];

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @param {vscode.DataTransfer} dataTransfer
 * @param {vscode.CancellationToken} token
 */
async function buildEdit(document, position, dataTransfer, token) {
	const candidates = await candidatesFrom(dataTransfer);
	if (!candidates.length) return null;

	const result = await ingest(document, candidates, token);
	if (!result || token.isCancellationRequested) return null;

	const { prefix, suffix } = blockInsertPadding(document.getText(), document.offsetAt(position));
	const snippet = new vscode.SnippetString(prefix + result.snippet + suffix);

	for (const notice of result.notices) vscode.window.showWarningMessage(notice);

	const count = result.entries.length;
	const gallery = result.entries.filter((entry) => entry.media === 'image').length > 1;
	const title = gallery
		? `Add ${count} images as a gallery`
		: count > 1
			? `Add ${count} files to static/`
			: 'Add to static/';

	return { snippet, workspaceEdit: result.edit, title };
}

class MediaDropProvider {
	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Position} position
	 * @param {vscode.DataTransfer} dataTransfer
	 * @param {vscode.CancellationToken} token
	 */
	async provideDocumentDropEdits(document, position, dataTransfer, token) {
		const built = await buildEdit(document, position, dataTransfer, token);
		if (!built) return undefined;

		const edit = new vscode.DocumentDropEdit(built.snippet);
		edit.title = built.title;
		edit.kind = mediaEditKind();
		edit.additionalEdit = built.workspaceEdit;
		return edit;
	}
}

class MediaPasteProvider {
	/**
	 * @param {vscode.TextDocument} document
	 * @param {readonly vscode.Range[]} ranges
	 * @param {vscode.DataTransfer} dataTransfer
	 * @param {unknown} _context
	 * @param {vscode.CancellationToken} token
	 */
	async provideDocumentPasteEdits(document, ranges, dataTransfer, _context, token) {
		const built = await buildEdit(document, ranges[0].start, dataTransfer, token);
		if (!built) return undefined;

		const kind = mediaEditKind();
		const edit = new vscode.DocumentPasteEdit(built.snippet, built.title, kind);
		edit.additionalEdit = built.workspaceEdit;
		return [edit];
	}
}

/**
 * @param {vscode.DocumentSelector} selector
 * @returns {vscode.Disposable[]}
 */
function register(selector) {
	/** @type {vscode.Disposable[]} */
	const disposables = [];
	const kind = mediaEditKind();

	disposables.push(
		vscode.languages.registerDocumentDropEditProvider(selector, new MediaDropProvider(), {
			providedDropEditKinds: kind ? [kind] : undefined,
			dropMimeTypes: MIME_TYPES
		})
	);

	// Stable since VS Code 1.97. Older hosts — and Cursor builds that lag behind
	// it — still get drag and drop, which is the half that matters.
	if (typeof vscode.languages.registerDocumentPasteEditProvider === 'function' && kind) {
		try {
			disposables.push(
				vscode.languages.registerDocumentPasteEditProvider(selector, new MediaPasteProvider(), {
					providedPasteEditKinds: [kind],
					pasteMimeTypes: MIME_TYPES
				})
			);
		} catch {
			// Proposed-API-only in this host; the drop provider still covers it.
		}
	}

	return disposables;
}

module.exports = { KIND_ID, register };

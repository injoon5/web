'use strict';

const vscode = require('vscode');
const path = require('node:path');

const { blockInsertPadding, galleryFence } = require('../lib/insert');
const { catalogFor } = require('../lib/catalog');
const { counterpartPath, nextLanguage } = require('../lib/content-file');
const { ingest } = require('../lib/ingest');
const { parseFields, stringifyFrontmatter } = require('../lib/frontmatter');
const { scanMarkdown } = require('../lib/markdown-scan');
const { slugify } = require('../lib/naming');
const media = require('../lib/media');
const workspace = require('../lib/workspace');

/** @param {string} message */
function warn(message) {
	vscode.window.showWarningMessage(message);
}

function activeMarkdown() {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.languageId !== 'markdown') {
		warn('Open a markdown file first.');
		return null;
	}
	return editor;
}

/**
 * Same pipeline as a drop, reached through a file picker — which is how you add
 * media on a machine where dragging out of Finder is not an option.
 */
async function insertMedia() {
	const editor = activeMarkdown();
	if (!editor) return;

	const picked = await vscode.window.showOpenDialog({
		canSelectMany: true,
		openLabel: 'Add to post',
		filters: {
			Media: [...media.WEB_IMAGE, ...media.CONVERT_IMAGE, ...media.VIDEO].map((ext) => ext.slice(1))
		}
	});
	if (!picked?.length) return;

	const candidates = picked.map((uri) => ({
		name: path.basename(uri.fsPath),
		uri,
		read: () => vscode.workspace.fs.readFile(uri)
	}));

	const result = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Window, title: 'Adding media...' },
		() => ingest(editor.document, candidates)
	);
	if (!result) return;

	for (const notice of result.notices) warn(notice);

	// The file writes and the import splice go in first; the editor moves the
	// cursor for us, so the snippet still lands where it was asked for.
	await vscode.workspace.applyEdit(result.edit);

	const offset = editor.document.offsetAt(editor.selection.active);
	const { prefix, suffix } = blockInsertPadding(editor.document.getText(), offset);
	await editor.insertSnippet(new vscode.SnippetString(prefix + result.snippet + suffix));
}

/** Jump to the same entry in the next language, offering to create it. */
async function openCounterpart() {
	const editor = activeMarkdown();
	if (!editor) return;

	const context = workspace.describe(editor.document);
	if (!context?.content) {
		warn('This file is not in the content tree.');
		return;
	}

	const lang = nextLanguage(context.content.lang, context.config.languages);
	const rel = counterpartPath(context.content, lang, context.config);
	const uri = workspace.join(context.folder, rel);

	if (await workspace.exists(uri)) {
		await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
		return;
	}

	const create = await vscode.window.showInformationMessage(
		`No ${lang} version of ${context.content.slug}. Create it?`,
		{ modal: true },
		'Create'
	);
	if (create !== 'Create') return;

	const scan = scanMarkdown(editor.document.getText());
	const fields = scan.frontmatter ? parseFields(scan.frontmatter.body, 1) : new Map();

	/** @type {Array<[string, string | boolean | string[]]>} */
	const entries = [];
	for (const [key, field] of fields) {
		if (key === 'published') continue;
		entries.push([key, field.value]);
	}
	entries.push(['published', false]);

	const edit = new vscode.WorkspaceEdit();
	edit.createFile(uri, {
		contents: Buffer.from(`${stringifyFrontmatter(entries)}\n\n`, 'utf8'),
		ignoreIfExists: true
	});
	await vscode.workspace.applyEdit(edit);

	await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
}

/** Wrap the selection in an explicit `:::gallery` fence. */
async function wrapGallery() {
	const editor = activeMarkdown();
	if (!editor) return;

	const selection = editor.selection.isEmpty
		? editor.document.lineAt(editor.selection.active.line).range
		: new vscode.Range(
				editor.selection.start.with({ character: 0 }),
				editor.document.lineAt(editor.selection.end.line).range.end
			);

	const text = editor.document.getText(selection);
	await editor.edit((builder) => builder.replace(selection, galleryFence(text)));
}

/** Scaffold both languages of a new entry, plus the folder its media goes in. */
async function newContent() {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) return;

	const config = workspace.getConfig(folder.uri);
	const catalog = catalogFor(folder);
	await catalog.ready();

	const kinds = [...new Set([...Object.keys(config.assetFolders), 'blog', 'projects'])];
	const kind = await vscode.window.showQuickPick(kinds, { placeHolder: 'What are you writing?' });
	if (!kind) return;

	const title = await vscode.window.showInputBox({
		prompt: `Title of the new ${kind} entry`,
		ignoreFocusOut: true
	});
	if (!title) return;

	const slug = await vscode.window.showInputBox({
		prompt: 'Slug — this is the URL, and the folder its images go in',
		value: slugify(title),
		ignoreFocusOut: true,
		validateInput: (value) =>
			!value.trim()
				? 'A slug is required.'
				: catalog.get(kind, value.trim())
					? `${kind}/${value.trim()} already exists.`
					: null
	});
	if (!slug) return;

	const today = new Date().toISOString().slice(0, 10);
	const edit = new vscode.WorkspaceEdit();

	for (const lang of config.languages) {
		/** @type {Array<[string, string | boolean | string[]]>} */
		const entries =
			kind === 'blog'
				? [
						['type', 'blog'],
						['title', title],
						['slug', slug],
						['description', ''],
						['date', today],
						['coverimage', ''],
						['published', false]
					]
				: [
						['title', title],
						['description', ''],
						['year', today.slice(0, 4)],
						['published', false]
					];

		const uri = workspace.join(folder, `${config.contentRoot}/${kind}/${lang}/${slug}.md`);
		edit.createFile(uri, {
			contents: Buffer.from(`${stringifyFrontmatter(entries)}\n\n`, 'utf8'),
			ignoreIfExists: true
		});
	}

	await vscode.workspace.applyEdit(edit);

	const first = workspace.join(
		folder,
		`${config.contentRoot}/${kind}/${config.languages[0]}/${slug}.md`
	);
	await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(first));
}

/** Open the folder this entry's media lives in. */
async function revealAssets() {
	const editor = activeMarkdown();
	if (!editor) return;

	const context = workspace.describe(editor.document);
	const target = context && workspace.assetTarget(context, 'image');
	if (!target) return;

	if (!(await workspace.exists(target.uri))) {
		await vscode.workspace.fs.createDirectory(target.uri);
	}
	await vscode.commands.executeCommand('revealFileInOS', target.uri);
}

/** Flip `published` without scrolling back to the top of the file. */
async function togglePublished() {
	const editor = activeMarkdown();
	if (!editor) return;

	const scan = scanMarkdown(editor.document.getText());
	if (!scan.frontmatter) {
		warn('This file has no frontmatter.');
		return;
	}

	const field = parseFields(scan.frontmatter.body, 1).get('published');
	if (!field) {
		warn('No `published` field to toggle.');
		return;
	}

	const next = field.value === true ? 'false' : 'true';
	const range = new vscode.Range(
		field.line,
		field.column,
		field.line,
		field.column + field.raw.length
	);

	await editor.edit((builder) => builder.replace(range, next));
	vscode.window.setStatusBarMessage(`published: ${next}`, 2000);
}

/** Everything under the media folders that nothing in the repo refers to. */
async function findUnusedAssets() {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) return;

	const config = workspace.getConfig(folder.uri);

	const found = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: 'Scanning for unreferenced media' },
		async () => {
			const assets = await vscode.workspace.findFiles(
				new vscode.RelativePattern(folder, `${config.staticRoot}/{images,videos}/**/*`)
			);

			const sources = await vscode.workspace.findFiles(
				'{src,convex,scripts}/**/*.{md,svelte,js,ts,css,json}',
				'**/node_modules/**'
			);

			// One pass over the sources, not one per asset.
			const haystack = (
				await Promise.all(
					sources.map(async (uri) => {
						try {
							return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
						} catch {
							return '';
						}
					})
				)
			).join('\n');

			/** @type {{ uri: vscode.Uri, url: string, size: number }[]} */
			const unused = [];
			for (const uri of assets) {
				const url = workspace.urlForUri(folder, config, uri);
				if (!url) continue;
				if (haystack.includes(url) || haystack.includes(path.basename(url))) continue;

				const stat = await vscode.workspace.fs.stat(uri);
				unused.push({ uri, url, size: stat.size });
			}

			return unused.sort((a, b) => b.size - a.size);
		}
	);

	if (!found.length) {
		vscode.window.showInformationMessage('Every file under images/ and videos/ is referenced.');
		return;
	}

	const picked = await vscode.window.showQuickPick(
		found.map((entry) => ({
			label: entry.url,
			description: `${Math.max(1, Math.round(entry.size / 1024))} KB`,
			entry
		})),
		{
			canPickMany: true,
			title: `${found.length} unreferenced files`,
			placeHolder: 'Select any you want to delete — nothing is deleted until you confirm'
		}
	);
	if (!picked?.length) return;

	const confirm = await vscode.window.showWarningMessage(
		`Delete ${picked.length} file${picked.length === 1 ? '' : 's'}?`,
		{ modal: true, detail: picked.map((item) => item.label).join('\n') },
		'Delete'
	);
	if (confirm !== 'Delete') return;

	for (const item of picked) {
		await vscode.workspace.fs.delete(item.entry.uri, { useTrash: true });
	}
	vscode.window.showInformationMessage(`Deleted ${picked.length} file(s) to trash.`);
}

/** Hand off to the repo's own image pipeline. */
async function optimizeImages() {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) return;

	const terminal =
		vscode.window.terminals.find((item) => item.name === 'optimize-images') ??
		vscode.window.createTerminal({ name: 'optimize-images', cwd: folder.uri });

	terminal.show();
	terminal.sendText('npm run optimize-images');
}

function register() {
	const commands = {
		'webAuthoring.insertMedia': insertMedia,
		'webAuthoring.openCounterpart': openCounterpart,
		'webAuthoring.wrapGallery': wrapGallery,
		'webAuthoring.newContent': newContent,
		'webAuthoring.revealAssets': revealAssets,
		'webAuthoring.togglePublished': togglePublished,
		'webAuthoring.findUnusedAssets': findUnusedAssets,
		'webAuthoring.optimizeImages': optimizeImages
	};

	return Object.entries(commands).map(([id, handler]) =>
		vscode.commands.registerCommand(id, async (...args) => {
			try {
				await handler(...args);
			} catch (error) {
				vscode.window.showErrorMessage(`${id}: ${error?.message ?? error}`);
			}
		})
	);
}

module.exports = { register };

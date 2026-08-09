'use strict';

const vscode = require('vscode');
const path = require('node:path');

const { assetFolderFor, classifyContentPath, toPosix } = require('./content-file');

/**
 * The bridge between the pure modules and the editor: settings, workspace
 * folders, and the two directions of the `/...` URL mapping.
 */

/** @param {vscode.Uri} [resource] */
function getConfig(resource) {
	const raw = vscode.workspace.getConfiguration('webAuthoring', resource);

	return {
		contentRoot: raw.get('contentRoot', 'src/content'),
		staticRoot: raw.get('staticRoot', 'static'),
		languages: raw.get('languages', ['en', 'ko']),
		assetFolders: raw.get('assetFolders', {}),
		fallbackAssetFolder: raw.get('fallbackAssetFolder', {}),
		naming: raw.get('naming', 'auto'),
		transcode: raw.get('transcode', 'heicOnly'),
		transcodeTarget: raw.get('transcodeTarget', 'jpeg'),
		maxWidth: raw.get('maxWidth', 2400),
		altTextPlaceholder: raw.get('altTextPlaceholder', true),
		videoComponent: raw.get('videoComponent', {
			name: 'LazyVideo',
			path: '$lib/ui/LazyVideo.svelte'
		}),
		statusBar: raw.get('statusBar', true),
		diagnostics: {
			enabled: raw.get('diagnostics.enabled', true),
			requireAltText: raw.get('diagnostics.requireAltText', true),
			missingTranslation: raw.get('diagnostics.missingTranslation', true),
			oversizeWidth: raw.get('diagnostics.oversizeWidth', 4000)
		}
	};
}

/** @param {vscode.Uri} uri */
function folderFor(uri) {
	return vscode.workspace.getWorkspaceFolder(uri) ?? vscode.workspace.workspaceFolders?.[0] ?? null;
}

/**
 * @param {vscode.WorkspaceFolder} folder
 * @param {vscode.Uri} uri
 */
function relativeTo(folder, uri) {
	return toPosix(path.relative(folder.uri.fsPath, uri.fsPath));
}

/**
 * Where a document sits in the content tree, plus the folder it belongs to.
 *
 * @param {vscode.TextDocument | vscode.Uri} target
 */
function describe(target) {
	const uri = target instanceof vscode.Uri ? target : target.uri;
	if (uri.scheme !== 'file') return null;

	const folder = folderFor(uri);
	if (!folder) return null;

	const config = getConfig(uri);
	const rel = relativeTo(folder, uri);
	const content = classifyContentPath(rel, config);

	return { uri, folder, config, rel, content };
}

/**
 * @param {vscode.WorkspaceFolder} folder
 * @param {string} relPath  relative to the workspace root
 */
function join(folder, relPath) {
	return vscode.Uri.joinPath(folder.uri, ...toPosix(relPath).split('/').filter(Boolean));
}

/**
 * `/images/uploads/us-camp/gate.jpeg` -> the file on disk.
 *
 * @param {vscode.WorkspaceFolder} folder
 * @param {ReturnType<typeof getConfig>} config
 * @param {string} url
 */
function uriForUrl(folder, config, url) {
	const clean = decodeURI(String(url).split(/[?#]/)[0]);
	if (!clean.startsWith('/')) return null;
	return join(folder, `${config.staticRoot}${clean}`);
}

/**
 * The file on disk -> the URL the site serves it at, or `null` when it is not
 * under the static root at all.
 *
 * @param {vscode.WorkspaceFolder} folder
 * @param {ReturnType<typeof getConfig>} config
 * @param {vscode.Uri} uri
 */
function urlForUri(folder, config, uri) {
	const rel = relativeTo(folder, uri);
	const root = toPosix(config.staticRoot);
	if (rel !== root && !rel.startsWith(`${root}/`)) return null;
	return rel.slice(root.length);
}

/**
 * The folder a dropped file belongs in, as a Uri and as a URL prefix.
 *
 * @param {ReturnType<typeof describe>} context
 * @param {'image' | 'video'} media
 */
function assetTarget(context, media) {
	if (!context) return null;

	const fallbackSlug = path.basename(context.rel).replace(/\.md$/, '');
	const relative = assetFolderFor(context.content, media, context.config, fallbackSlug);

	return {
		uri: join(context.folder, `${context.config.staticRoot}/${relative}`),
		url: `/${relative}`,
		slug: context.content?.slug ?? fallbackSlug
	};
}

/** @param {vscode.Uri} uri */
async function exists(uri) {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

/**
 * Filenames without extensions, lowercased — what `naming.fileNameFor` needs to
 * avoid both a collision and a reused sequence number.
 *
 * @param {vscode.Uri} dir
 */
async function takenStems(dir) {
	/** @type {Set<string>} */
	const stems = new Set();
	try {
		for (const [name] of await vscode.workspace.fs.readDirectory(dir)) {
			stems.add(name.replace(/\.[^.]*$/, '').toLowerCase());
		}
	} catch {
		// A folder that does not exist yet has nothing in it.
	}
	return stems;
}

module.exports = {
	assetTarget,
	describe,
	exists,
	folderFor,
	getConfig,
	join,
	relativeTo,
	takenStems,
	uriForUrl,
	urlForUri
};

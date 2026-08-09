'use strict';

const vscode = require('vscode');

const { imageSize } = require('../lib/image-size');
const { scanMarkdown } = require('../lib/markdown-scan');
const media = require('../lib/media');
const workspace = require('../lib/workspace');

/**
 * The two things a `/images/...` string in a post should do in an editor:
 * open the file on cmd-click, and show it on hover.
 */

/**
 * Every media URL in the document, with the range it occupies.
 *
 * @param {vscode.TextDocument} document
 */
function mediaReferences(document) {
	const scan = scanMarkdown(document.getText());
	/** @type {{ url: string, range: vscode.Range }[]} */
	const refs = [];

	for (const image of scan.images) {
		refs.push({
			url: image.url,
			range: new vscode.Range(
				document.positionAt(image.urlIndex),
				document.positionAt(image.urlIndex + image.url.length)
			)
		});
	}

	for (const attr of scan.attrUrls) {
		refs.push({
			url: attr.url,
			range: new vscode.Range(
				document.positionAt(attr.index),
				document.positionAt(attr.index + attr.url.length)
			)
		});
	}

	return refs;
}

/** @param {number} bytes */
function humanSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

class MediaLinkProvider {
	/** @param {vscode.TextDocument} document */
	provideDocumentLinks(document) {
		const context = workspace.describe(document);
		if (!context) return [];

		/** @type {vscode.DocumentLink[]} */
		const links = [];
		for (const ref of mediaReferences(document)) {
			if (!ref.url.startsWith('/')) continue;
			const uri = workspace.uriForUrl(context.folder, context.config, ref.url);
			if (!uri) continue;

			const link = new vscode.DocumentLink(ref.range, uri);
			link.tooltip = 'Open file';
			links.push(link);
		}
		return links;
	}
}

class MediaHoverProvider {
	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Position} position
	 */
	async provideHover(document, position) {
		const context = workspace.describe(document);
		if (!context) return undefined;

		const ref = mediaReferences(document).find((entry) => entry.range.contains(position));
		if (!ref || !ref.url.startsWith('/')) return undefined;

		const uri = workspace.uriForUrl(context.folder, context.config, ref.url);
		if (!uri) return undefined;

		const markdown = new vscode.MarkdownString();
		markdown.supportHtml = true;
		markdown.isTrusted = true;

		try {
			const stat = await vscode.workspace.fs.stat(uri);
			const kind = media.mediaKind(uri.fsPath);

			/** @type {string[]} */
			const facts = [humanSize(stat.size)];

			if (kind === 'image' && stat.size < 16 * 1024 * 1024) {
				const bytes = await vscode.workspace.fs.readFile(uri);
				const size = imageSize(bytes);
				if (size) facts.unshift(`${size.width} × ${size.height}`);
				markdown.appendMarkdown(`<img src="${uri.toString()}" width="320">\n\n`);
			}

			markdown.appendMarkdown(`\`${ref.url}\`\n\n${facts.join(' · ')}`);
		} catch {
			markdown.appendMarkdown(
				`\`${ref.url}\`\n\n$(error) Not found under \`${context.config.staticRoot}/\``
			);
		}

		return new vscode.Hover(markdown, ref.range);
	}
}

/** @param {vscode.DocumentSelector} selector */
function register(selector) {
	return [
		vscode.languages.registerDocumentLinkProvider(selector, new MediaLinkProvider()),
		vscode.languages.registerHoverProvider(selector, new MediaHoverProvider())
	];
}

module.exports = { mediaReferences, register };

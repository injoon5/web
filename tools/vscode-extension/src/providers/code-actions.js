'use strict';

const vscode = require('vscode');
const path = require('node:path');

const { CODE, SOURCE } = require('./diagnostics');
const { componentImportEdit } = require('../lib/insert');
const { kebabCase } = require('../lib/naming');
const { parseFields, quote, requiredKeys } = require('../lib/frontmatter');
const { scanMarkdown } = require('../lib/markdown-scan');
const workspace = require('../lib/workspace');

/** Cheap edit distance, only ever run against one folder listing. */
function distance(a, b) {
	const rows = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i += 1) {
		let previous = rows[0];
		rows[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const current = rows[j];
			rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
			previous = current;
		}
	}
	return rows[b.length];
}

/**
 * @param {string} title
 * @param {vscode.Diagnostic} diagnostic
 * @param {vscode.Uri} uri
 * @param {Array<[vscode.Range, string]>} replacements
 */
function quickFix(title, diagnostic, uri, replacements) {
	const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
	action.diagnostics = [diagnostic];
	action.edit = new vscode.WorkspaceEdit();
	for (const [range, text] of replacements) action.edit.replace(uri, range, text);
	return action;
}

class ContentCodeActionProvider {
	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Range} range
	 * @param {vscode.CodeActionContext} context
	 */
	async provideCodeActions(document, range, context) {
		const info = workspace.describe(document);
		if (!info) return [];

		/** @type {vscode.CodeAction[]} */
		const actions = [];

		for (const diagnostic of context.diagnostics) {
			if (diagnostic.source !== SOURCE) continue;

			switch (diagnostic.code) {
				case CODE.emptyAlt:
					actions.push(...this.#fillAlt(document, diagnostic));
					break;
				case CODE.smartQuote:
					actions.push(...this.#straightenQuote(document, diagnostic));
					break;
				case CODE.unclosedGallery:
					actions.push(...this.#closeFence(document, diagnostic));
					break;
				case CODE.missingField:
					actions.push(...this.#addFields(document, diagnostic, info));
					break;
				case CODE.slugMismatch:
					actions.push(...this.#fixSlug(document, diagnostic, info));
					break;
				case CODE.missingImport:
					actions.push(...this.#addImport(document, diagnostic, info));
					break;
				case CODE.missingMedia:
					actions.push(...(await this.#suggestPath(document, diagnostic, info)));
					break;
				case CODE.missingTranslation:
					actions.push(this.#createTranslation(diagnostic));
					break;
				default:
					break;
			}
		}

		return actions;
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Diagnostic} diagnostic
	 */
	#fillAlt(document, diagnostic) {
		const text = document.getText(diagnostic.range);
		const url = /\]\(\s*([^)\s]+)/.exec(text)?.[1];
		if (!url) return [];

		const stem = path.basename(decodeURI(url)).replace(/\.[^.]*$/, '');
		const words = kebabCase(stem).split('-').filter(Boolean);
		if (!words.length) return [];

		const alt = words.join(' ').replace(/^./, (char) => char.toUpperCase());
		const start = document.offsetAt(diagnostic.range.start) + 2;
		const at = new vscode.Range(document.positionAt(start), document.positionAt(start));

		return [quickFix(`Set alt text to "${alt}"`, diagnostic, document.uri, [[at, alt]])];
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Diagnostic} diagnostic
	 */
	#straightenQuote(document, diagnostic) {
		const found = document.getText(diagnostic.range);
		const straight = found === '‘' || found === '’' ? "'" : '"';
		return [
			quickFix(`Replace with ${straight}`, diagnostic, document.uri, [[diagnostic.range, straight]])
		];
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Diagnostic} diagnostic
	 */
	#closeFence(document, diagnostic) {
		// Close after the run of non-blank lines the fence opened over — that is
		// the group the author meant, and it is where a closing `:::` would go.
		let line = diagnostic.range.start.line + 1;
		while (line < document.lineCount && document.lineAt(line).text.trim() !== '') line += 1;

		const end = document.lineAt(Math.max(0, line - 1)).range.end;
		return [
			quickFix('Close the gallery fence', diagnostic, document.uri, [
				[new vscode.Range(end, end), '\n:::']
			])
		];
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Diagnostic} diagnostic
	 * @param {ReturnType<typeof workspace.describe>} info
	 */
	#addFields(document, diagnostic, info) {
		const scan = scanMarkdown(document.getText());
		const kind = info.content?.kind ?? 'blog';
		const today = new Date().toISOString().slice(0, 10);

		const defaults = {
			type: kind === 'blog' ? 'blog' : '',
			title: info.content?.slug ?? '',
			slug: info.content?.slug ?? '',
			description: '',
			date: today,
			year: today.slice(0, 4),
			published: false
		};

		if (!scan.frontmatter) {
			const block = requiredKeys(kind)
				.map((key) => `${key}: ${quote(defaults[key] ?? '')}`)
				.join('\n');
			const at = new vscode.Range(0, 0, 0, 0);
			return [
				quickFix('Add frontmatter', diagnostic, document.uri, [[at, `---\n${block}\n---\n\n`]])
			];
		}

		const fields = parseFields(scan.frontmatter.body, 1);
		const missing = requiredKeys(kind).filter((key) => !fields.has(key));
		if (!missing.length) return [];

		const insertion = missing.map((key) => `${key}: ${quote(defaults[key] ?? '')}`).join('\n');
		const closing = document.positionAt(scan.frontmatter.end).with({ character: 0 });

		return [
			quickFix(`Add ${missing.join(', ')}`, diagnostic, document.uri, [
				[new vscode.Range(closing, closing), `${insertion}\n`]
			])
		];
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Diagnostic} diagnostic
	 * @param {ReturnType<typeof workspace.describe>} info
	 */
	#fixSlug(document, diagnostic, info) {
		if (!info.content) return [];
		return [
			quickFix(`Set slug to '${info.content.slug}'`, diagnostic, document.uri, [
				[diagnostic.range, `'${info.content.slug}'`]
			])
		];
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Diagnostic} diagnostic
	 * @param {ReturnType<typeof workspace.describe>} info
	 */
	#addImport(document, diagnostic, info) {
		const name = document.getText(diagnostic.range);
		const known = {
			[info.config.videoComponent?.name ?? 'LazyVideo']:
				info.config.videoComponent?.path ?? '$lib/ui/LazyVideo.svelte',
			Gallery: '$lib/lightbox/Gallery.svelte'
		};

		const importPath = known[name] ?? `$lib/ui/${name}.svelte`;
		const edit = componentImportEdit(document.getText(), { name, path: importPath });
		if (!edit) return [];

		const at = document.positionAt(edit.offset);
		return [
			quickFix(`Import ${name} from ${importPath}`, diagnostic, document.uri, [
				[new vscode.Range(at, at), edit.insert]
			])
		];
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Diagnostic} diagnostic
	 * @param {ReturnType<typeof workspace.describe>} info
	 */
	async #suggestPath(document, diagnostic, info) {
		const url = document.getText(diagnostic.range);
		const dirUrl = url.slice(0, url.lastIndexOf('/') + 1);
		const wanted = url.slice(url.lastIndexOf('/') + 1);

		const dirUri = workspace.uriForUrl(info.folder, info.config, dirUrl);
		if (!dirUri) return [];

		/** @type {[string, vscode.FileType][]} */
		let listing;
		try {
			listing = await vscode.workspace.fs.readDirectory(dirUri);
		} catch {
			return [];
		}

		const near = listing
			.filter(([, type]) => type === vscode.FileType.File)
			.map(([name]) => ({ name, score: distance(name.toLowerCase(), wanted.toLowerCase()) }))
			.filter((entry) => entry.score <= Math.max(3, Math.floor(wanted.length / 3)))
			.sort((a, b) => a.score - b.score)
			.slice(0, 3);

		return near.map((entry) =>
			quickFix(`Change to ${dirUrl}${entry.name}`, diagnostic, document.uri, [
				[diagnostic.range, `${dirUrl}${entry.name}`]
			])
		);
	}

	/** @param {vscode.Diagnostic} diagnostic */
	#createTranslation(diagnostic) {
		const action = new vscode.CodeAction(
			'Create the missing translation',
			vscode.CodeActionKind.QuickFix
		);
		action.diagnostics = [diagnostic];
		action.command = {
			command: 'webAuthoring.openCounterpart',
			title: 'Create the missing translation'
		};
		return action;
	}
}

/** @param {vscode.DocumentSelector} selector */
function register(selector) {
	return vscode.languages.registerCodeActionsProvider(selector, new ContentCodeActionProvider(), {
		providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
	});
}

module.exports = { register };
